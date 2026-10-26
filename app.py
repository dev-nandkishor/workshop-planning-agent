"""A bounded host for a local workshop planning agent."""

from __future__ import annotations

import inspect
import json
import logging
import os
from pathlib import Path
from typing import Any, Callable

import ollama

from tools import calculate_budget, check_resources

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
log = logging.getLogger(__name__)

MODEL_NAME = os.environ.get("OLLAMA_MODEL", "llama3.1:8b").strip() or "llama3.1:8b"
OLLAMA_HOST = (
    os.environ.get("OLLAMA_HOST", "http://localhost:11434").strip().rstrip("/")
    or "http://localhost:11434"
)
OLLAMA_API_KEY = os.environ.get("OLLAMA_API_KEY", "").strip()
MAX_STEPS = 5

TOOLS: dict[str, Callable[..., dict[str, Any]]] = {
    "calculate_budget": calculate_budget,
    "check_resources": check_resources,
}
ORDER = ("calculate_budget", "check_resources")

SYSTEM_PROMPT = """You are a workshop planning assistant.

Use the declared tools for all calculations and inventory checks. First invoke
calculate_budget, then check_resources. Invoke tools only through the provided
function-calling interface; never print a tool name or arguments as ordinary
text, JSON, or pseudo-code. Request exactly one tool per turn, and request each
tool only once.

After calculate_budget succeeds, immediately invoke check_resources before
writing any summary. Do not produce a partial answer while a required tool is
still outstanding. Only after both tool results are present may you write the
final summary. Use INR. Do not guess inputs or inventory. If inputs are
missing, ask the user for them. A negative remaining budget means the plan is
over budget.
"""


def build_system_prompt() -> str:
    """Load the base instructions and the local skill specification."""
    path = Path(__file__).resolve().with_name("SKILL.md")
    return SYSTEM_PROMPT + "\n" + path.read_text(encoding="utf-8")


def validate_args(name: str, args: object) -> str | None:
    """Validate argument dictionary types and function signature compliance."""
    if name not in TOOLS:
        return f"Unknown tool: {name}"
    if not isinstance(args, dict):
        return "Tool arguments must be a dictionary"
    if not all(isinstance(key, str) for key in args):
        return "Argument names must be strings"

    try:
        inspect.signature(TOOLS[name]).bind(**args)
    except TypeError as exc:
        return str(exc)
    return None


def dispatch(name: str, args: object) -> dict:
    """Safely route calls to allowlisted functions and catch runtime exceptions."""
    if name not in TOOLS:
        return {"error": f"Unknown tool: {name}"}

    problem = validate_args(name, args)
    if problem:
        return {"error": problem}

    try:
        # Signature validation above guarantees a mapping with string keys.
        return TOOLS[name](**args)  # type: ignore[arg-type]
    except Exception as exc:
        return {"error": f"{type(exc).__name__}: {exc}"}


def run_agent(
    user_query: str,
    client: ollama.Client | None = None,
    on_event: Callable[[dict[str, Any]], None] | None = None,
) -> str:
    """Run one bounded tool-use session and return a user-facing response.

    ``on_event`` is an optional presentation hook used by the web host. Tool
    execution and security decisions do not depend on it.
    """

    def emit(event_type: str, **fields: Any) -> None:
        if on_event is None:
            return
        try:
            on_event({"type": event_type, **fields})
        except Exception:
            log.exception("Agent event callback failed")

    if not isinstance(user_query, str) or not user_query.strip():
        emit("error", message="Please provide a workshop request.")
        return "Please provide a workshop request."

    try:
        system = build_system_prompt()
    except OSError as exc:
        message = f"Cannot load SKILL.md: {exc}"
        emit("error", message=message)
        return message

    if client is None:
        client = ollama.Client(host=OLLAMA_HOST, timeout=120.0)

    emit(
        "session",
        model=MODEL_NAME,
        workflow=list(ORDER),
        max_steps=MAX_STEPS,
    )

    messages: list[Any] = [
        {"role": "system", "content": system},
        {"role": "user", "content": user_query},
    ]
    completed: list[str] = []

    for step in range(1, MAX_STEPS + 1):
        # Gate 0: expose only the next tool required by the workflow.
        pending = ORDER[len(completed) : len(completed) + 1]
        declarations = [TOOLS[name] for name in pending]

        emit(
            "status",
            state="thinking",
            step=step,
            next_tool=pending[0] if pending else None,
            message=(
                f"Requesting {pending[0]} from the local model."
                if pending
                else "Preparing the final summary."
            ),
        )

        request: dict[str, Any] = {
            "model": MODEL_NAME,
            "messages": messages,
            "options": {"temperature": 0},
        }
        if declarations:
            request["tools"] = declarations

        try:
            response = client.chat(**request)
        except Exception as exc:
            message = f"Model request failed: {type(exc).__name__}: {exc}"
            emit("error", step=step, message=message)
            return message

        message = response.message
        messages.append(message)
        calls = message.tool_calls or []

        if not calls:
            text = (message.content or "").strip()
            if len(completed) < len(ORDER):
                return (
                    "Plan incomplete; both tool checks are required.\n"
                    + (text or "Please supply all required inputs.")
                )
            return text or "Both checks finished; model summary was empty."

        if len(calls) != 1:
            emit(
                "guardrail",
                step=step,
                rule="one_tool_per_turn",
                message="Multiple tool calls were rejected.",
            )
            return "Stopped: request exactly one tool per turn."

        call = calls[0]
        name = call.function.name
        args = call.function.arguments

        # Gate 1: allowlist and workflow-order enforcement.
        if name not in TOOLS:
            emit(
                "guardrail",
                step=step,
                rule="tool_allowlist",
                message=f"Unknown tool was rejected: {name}.",
            )
            return f"Stopped: unknown tool {name}."
        if not pending or name != pending[0]:
            emit(
                "guardrail",
                step=step,
                rule="workflow_order",
                message=f"Out-of-order or repeated tool was rejected: {name}.",
            )
            return f"Stopped: tool {name} is out of order or repeated."

        log.info("Step %d REQUEST %s %s", step, name, args)
        emit("tool_call", step=step, name=name, arguments=args)

        # Gates 2 and 3: argument/signature validation and safe execution.
        result = dispatch(name, args)
        log.info("Step %d RESULT %s %s", step, name, result)
        emit(
            "tool_result",
            step=step,
            name=name,
            result=result,
            ok="error" not in result,
        )

        try:
            payload = json.dumps(result)
        except (TypeError, ValueError) as exc:
            message = f"Stopped: {name}: result was not JSON serializable: {exc}"
            emit("error", step=step, message=message)
            return message

        messages.append(
            {
                "role": "tool",
                "tool_name": name,
                "content": payload,
            }
        )

        # Fail safe: never feed a tool error back for a blind retry.
        if "error" in result:
            return f"Stopped: {name}: {result['error']}"

        completed.append(name)

    message = "Stopped: reached MAX_STEPS without a final answer."
    emit("error", message=message)
    return message


if __name__ == "__main__":
    query = (
        "Plan a two-day workshop for 30 students within a "
        "15000 INR budget. Daily cost per person is 200 INR. "
        "Check projector, Wi-Fi, whiteboard, laptops, "
        "and microphones."
    )
    print(run_agent(query))
