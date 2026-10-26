"""Local Flask host for the workshop planning agent."""

from __future__ import annotations

import json
import logging
import os
import queue
import threading
import time
from typing import Any
from urllib.request import Request, urlopen

from flask import (
    Flask,
    Response,
    jsonify,
    render_template,
    request,
    stream_with_context,
)

from app import MAX_STEPS, MODEL_NAME, OLLAMA_API_KEY, OLLAMA_HOST, run_agent

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
log = logging.getLogger(__name__)

REPO_URL = "https://github.com/dev-nandkishor/workshop-planning-agent"
MAX_QUERY_CHARS = 2_000
MAX_REQUEST_BYTES = 16 * 1024
KEEPALIVE_SECONDS = 12
RUN_LOCK = threading.Lock()

BLOCKED_PREFIXES = (
    "Stopped:",
    "Plan incomplete;",
    "Model request failed:",
    "Cannot load SKILL.md:",
    "Please provide a workshop request.",
)

app = Flask(__name__, static_folder="public", static_url_path="")
app.config["MAX_CONTENT_LENGTH"] = MAX_REQUEST_BYTES


def _ollama_status() -> tuple[bool, bool]:
    """Return (server_reachable, model_installed) with a short timeout."""
    request_ = Request(f"{OLLAMA_HOST}/api/tags")
    if OLLAMA_API_KEY:
        request_.add_header("Authorization", f"Bearer {OLLAMA_API_KEY}")
    try:
        with urlopen(request_, timeout=2) as response:
            payload = json.loads(response.read(1_000_000).decode("utf-8"))
    except Exception:
        return False, False

    models = payload.get("models", [])
    names = {
        str(item.get("name") or item.get("model") or "")
        for item in models
        if isinstance(item, dict)
    }
    return True, MODEL_NAME in names


def _final_status(result: str) -> str:
    return "blocked" if result.startswith(BLOCKED_PREFIXES) else "success"


def _encode_event(event: dict[str, Any]) -> str:
    return json.dumps(event, ensure_ascii=False, default=str) + "\n"


@app.after_request
def _add_security_headers(response: Response) -> Response:
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("X-Frame-Options", "DENY")
    response.headers.setdefault("Referrer-Policy", "no-referrer")
    response.headers.setdefault(
        "Permissions-Policy", "camera=(), microphone=(), geolocation=()"
    )
    response.headers.setdefault(
        "Content-Security-Policy",
        "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; "
        "img-src 'self' data:; connect-src 'self'; font-src 'self'; "
        "base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
    )
    if request.path.startswith("/api/"):
        response.headers.setdefault("Cache-Control", "no-store")
    return response


@app.errorhandler(413)
def _request_too_large(_error: Exception):
    if request.path.startswith("/api/"):
        return jsonify({"error": "The request is too large."}), 413
    return "Request too large", 413


@app.get("/")
def index():
    return render_template(
        "index.html",
        model=MODEL_NAME,
        repo_url=REPO_URL,
        max_query_chars=MAX_QUERY_CHARS,
    )


@app.get("/api/health")
def health():
    ollama_up, model_ready = _ollama_status()
    return jsonify(
        {
            "ok": ollama_up and model_ready,
            "ollama": ollama_up,
            "model": MODEL_NAME,
            "model_ready": model_ready,
        }
    )


@app.post("/api/plan")
def plan():
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return jsonify({"error": "Request body must be a JSON object."}), 400

    query = data.get("query")
    if not isinstance(query, str) or not query.strip():
        return jsonify({"error": "Please provide a workshop request."}), 400

    query = query.strip()
    if len(query) > MAX_QUERY_CHARS:
        return jsonify(
            {"error": f"Workshop request must be {MAX_QUERY_CHARS} characters or fewer."}
        ), 400

    if not RUN_LOCK.acquire(blocking=False):
        return jsonify(
            {"error": "Another planning run is already in progress. Please wait."}
        ), 429

    events: queue.Queue[dict[str, Any] | None] = queue.Queue()
    started = time.monotonic()

    def emit(event: dict[str, Any]) -> None:
        item = dict(event)
        item["elapsed"] = round(time.monotonic() - started, 2)
        events.put(item)

    def worker() -> None:
        try:
            result = run_agent(query, on_event=emit)
            events.put(
                {
                    "type": "final",
                    "content": result,
                    "status": _final_status(result),
                    "elapsed": round(time.monotonic() - started, 2),
                }
            )
        except Exception:
            log.exception("Unhandled error while running the agent")
            events.put(
                {
                    "type": "error",
                    "message": "The server hit an unexpected error. Check the host logs.",
                    "elapsed": round(time.monotonic() - started, 2),
                }
            )
        finally:
            events.put(None)
            RUN_LOCK.release()

    try:
        threading.Thread(
            target=worker,
            name="workshop-agent",
            daemon=True,
        ).start()
    except Exception:
        RUN_LOCK.release()
        raise

    def generate():
        yield _encode_event(
            {
                "type": "accepted",
                "model": MODEL_NAME,
                "query": query,
                "max_steps": MAX_STEPS,
            }
        )
        while True:
            try:
                event = events.get(timeout=KEEPALIVE_SECONDS)
            except queue.Empty:
                yield _encode_event(
                    {
                        "type": "heartbeat",
                        "elapsed": round(time.monotonic() - started, 2),
                    }
                )
                continue

            if event is None:
                break
            yield _encode_event(event)

    response = Response(
        stream_with_context(generate()),
        mimetype="application/x-ndjson",
    )
    response.headers["Cache-Control"] = "no-cache, no-transform"
    response.headers["X-Accel-Buffering"] = "no"
    return response


if __name__ == "__main__":
    try:
        port = int(os.environ.get("PORT", "5000"))
    except ValueError:
        port = 5000

    log.info("Workshop Agent web UI: http://127.0.0.1:%s", port)
    app.run(
        host="127.0.0.1",
        port=port,
        debug=False,
        threaded=True,
        use_reloader=False,
    )
