"""Unit checks for the Flask host's validation and NDJSON stream."""

from __future__ import annotations

import json
import unittest
from unittest.mock import patch

import web_app


def read_events(response) -> list[dict]:
    return [
        json.loads(line)
        for line in response.get_data(as_text=True).splitlines()
        if line.strip()
    ]


class WebHostTests(unittest.TestCase):
    def setUp(self) -> None:
        self.client = web_app.app.test_client()

    def test_plan_streams_accepted_agent_events_and_final(self) -> None:
        calls: list[str] = []

        def fake_agent(query: str, on_event=None) -> str:
            calls.append(query)
            on_event({"type": "session", "model": "llama3.1:8b"})
            on_event(
                {
                    "type": "tool_call",
                    "step": 1,
                    "name": "calculate_budget",
                    "arguments": {"participants": 30},
                }
            )
            on_event(
                {
                    "type": "tool_result",
                    "step": 1,
                    "name": "calculate_budget",
                    "ok": True,
                    "result": {"total_estimated_cost": 12000},
                }
            )
            return "The plan is verified."

        with patch.object(web_app, "run_agent", fake_agent):
            response = self.client.post("/api/plan", json={"query": "Plan a workshop"})

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.mimetype, "application/x-ndjson")
        events = read_events(response)
        self.assertEqual(
            [event["type"] for event in events],
            ["accepted", "session", "tool_call", "tool_result", "final"],
        )
        self.assertEqual(events[-1]["status"], "success")
        self.assertEqual(events[-1]["content"], "The plan is verified.")
        self.assertIn("elapsed", events[-1])
        self.assertEqual(calls, ["Plan a workshop"])

    def test_blocked_result_is_classified_and_streamed(self) -> None:
        with patch.object(
            web_app,
            "run_agent",
            lambda query, on_event=None: "Stopped: unsafe request",
        ):
            response = self.client.post("/api/plan", json={"query": "bad"})

        events = read_events(response)
        self.assertEqual(events[-1]["type"], "final")
        self.assertEqual(events[-1]["status"], "blocked")
        self.assertEqual(events[-1]["content"], "Stopped: unsafe request")

    def test_rejects_missing_or_non_object_json(self) -> None:
        response = self.client.post("/api/plan", json={"query": "   "})
        self.assertEqual(response.status_code, 400)
        self.assertIn("error", response.get_json())

        response = self.client.post("/api/plan", json=[])
        self.assertEqual(response.status_code, 400)

        response = self.client.post("/api/plan", data="not json", content_type="application/json")
        self.assertEqual(response.status_code, 400)

    def test_rejects_oversized_workshop_brief(self) -> None:
        response = self.client.post(
            "/api/plan",
            json={"query": "x" * (web_app.MAX_QUERY_CHARS + 1)},
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn(str(web_app.MAX_QUERY_CHARS), response.get_json()["error"])

    def test_rejects_oversized_request_body(self) -> None:
        response = self.client.post(
            "/api/plan",
            data="x" * (web_app.MAX_REQUEST_BYTES + 1),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 413)
        self.assertEqual(response.get_json()["error"], "The request is too large.")

    def test_rejects_concurrent_run(self) -> None:
        with web_app.RUN_LOCK:
            response = self.client.post("/api/plan", json={"query": "Plan a workshop"})

        self.assertEqual(response.status_code, 429)
        self.assertIn("already in progress", response.get_json()["error"])

    def test_health_reports_model_status(self) -> None:
        with patch.object(web_app, "_ollama_status", return_value=(True, True)):
            response = self.client.get("/api/health")

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.get_json()["ok"])
        self.assertTrue(response.get_json()["model_ready"])

        with patch.object(web_app, "_ollama_status", return_value=(True, False)):
            response = self.client.get("/api/health")

        self.assertFalse(response.get_json()["ok"])
        self.assertTrue(response.get_json()["ollama"])
        self.assertFalse(response.get_json()["model_ready"])

    def test_security_headers_and_local_assets(self) -> None:
        response = self.client.get("/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.headers["X-Frame-Options"], "DENY")
        self.assertEqual(response.headers["X-Content-Type-Options"], "nosniff")
        self.assertIn("default-src 'self'", response.headers["Content-Security-Policy"])
        self.assertIn("script-src 'self'", response.headers["Content-Security-Policy"])
        self.assertIn(b"Run planning agent", response.data)
        self.assertIn(b"Workshop Agent", response.data)


if __name__ == "__main__":
    unittest.main()
