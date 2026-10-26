"""Unit checks for the bounded agent and its presentation event stream."""

from __future__ import annotations

import unittest
from types import SimpleNamespace

from app import run_agent


def tool_response(name: str, arguments: dict) -> SimpleNamespace:
    call = SimpleNamespace(
        function=SimpleNamespace(name=name, arguments=arguments)
    )
    return SimpleNamespace(
        message=SimpleNamespace(content="", tool_calls=[call])
    )


def multiple_tool_response() -> SimpleNamespace:
    calls = [
        SimpleNamespace(
            function=SimpleNamespace(
                name="calculate_budget",
                arguments={
                    "participants": 30,
                    "days": 2,
                    "daily_cost_per_person": 200,
                    "budget": 15000,
                },
            )
        ),
        SimpleNamespace(
            function=SimpleNamespace(
                name="check_resources",
                arguments={"required_items": "projector"},
            )
        ),
    ]
    return SimpleNamespace(message=SimpleNamespace(content="", tool_calls=calls))


def text_response(text: str) -> SimpleNamespace:
    return SimpleNamespace(
        message=SimpleNamespace(content=text, tool_calls=None)
    )


class FakeClient:
    def __init__(self, responses: list[SimpleNamespace]) -> None:
        self.responses = list(responses)
        self.requests: list[dict] = []

    def chat(self, **kwargs):
        self.requests.append({**kwargs, "messages": list(kwargs.get("messages") or [])})
        if not self.responses:
            raise AssertionError("Fake client received an unexpected extra request")
        return self.responses.pop(0)


HAPPY_RESPONSES = [
    tool_response(
        "calculate_budget",
        {
            "participants": 30,
            "days": 2,
            "daily_cost_per_person": 200,
            "budget": 15000,
        },
    ),
    tool_response(
        "check_resources",
        {"required_items": "projector,Wi-Fi,whiteboard,laptops,microphones"},
    ),
    text_response("The plan is verified."),
]


class AgentEventTests(unittest.TestCase):
    def test_happy_path_emits_ordered_events(self) -> None:
        client = FakeClient(HAPPY_RESPONSES)
        events: list[dict] = []

        result = run_agent("Plan the workshop", client=client, on_event=events.append)

        self.assertEqual(result, "The plan is verified.")
        self.assertEqual(
            [event["type"] for event in events],
            [
                "session",
                "status",
                "tool_call",
                "tool_result",
                "status",
                "tool_call",
                "tool_result",
                "status",
            ],
        )
        self.assertEqual(
            [event["name"] for event in events if event["type"] == "tool_call"],
            ["calculate_budget", "check_resources"],
        )
        budget_result = next(
            event
            for event in events
            if event["type"] == "tool_result"
            and event.get("name") == "calculate_budget"
        )
        self.assertEqual(
            budget_result["result"]["total_estimated_cost"],
            12000,
        )

    def test_cli_path_remains_unchanged_without_callback(self) -> None:
        client = FakeClient(
            [
                tool_response(
                    "calculate_budget",
                    {
                        "participants": 30,
                        "days": 2,
                        "daily_cost_per_person": 200,
                        "budget": 15000,
                    },
                ),
                tool_response(
                    "check_resources",
                    {"required_items": "projector,microphones"},
                ),
                text_response("CLI summary."),
            ]
        )

        self.assertEqual(run_agent("Plan the workshop", client=client), "CLI summary.")

    def test_empty_query_emits_error(self) -> None:
        events: list[dict] = []
        result = run_agent("   ", on_event=events.append)

        self.assertEqual(result, "Please provide a workshop request.")
        self.assertEqual(events[0]["type"], "error")

    def test_incomplete_workflow_is_blocked(self) -> None:
        client = FakeClient([text_response("I need more details.")])
        events: list[dict] = []

        result = run_agent("Plan the workshop", client=client, on_event=events.append)

        self.assertTrue(result.startswith("Plan incomplete;"))
        self.assertIn("I need more details.", result)
        self.assertFalse(any(event["type"] == "tool_call" for event in events))

    def test_multiple_tool_calls_are_blocked(self) -> None:
        client = FakeClient([multiple_tool_response()])
        events: list[dict] = []

        result = run_agent("Plan the workshop", client=client, on_event=events.append)

        self.assertEqual(result, "Stopped: request exactly one tool per turn.")
        guardrail = next(event for event in events if event["type"] == "guardrail")
        self.assertEqual(guardrail["rule"], "one_tool_per_turn")

    def test_unknown_tool_is_blocked(self) -> None:
        client = FakeClient([tool_response("delete_everything", {})])
        events: list[dict] = []

        result = run_agent("Plan the workshop", client=client, on_event=events.append)

        self.assertEqual(result, "Stopped: unknown tool delete_everything.")
        guardrail = next(event for event in events if event["type"] == "guardrail")
        self.assertEqual(guardrail["rule"], "tool_allowlist")

    def test_out_of_order_tool_is_blocked(self) -> None:
        client = FakeClient(
            [tool_response("check_resources", {"required_items": "projector"})]
        )
        events: list[dict] = []

        result = run_agent("Plan the workshop", client=client, on_event=events.append)

        self.assertEqual(
            result,
            "Stopped: tool check_resources is out of order or repeated.",
        )
        guardrail = next(event for event in events if event["type"] == "guardrail")
        self.assertEqual(guardrail["rule"], "workflow_order")

    def test_invalid_arguments_emit_failed_tool_result(self) -> None:
        client = FakeClient(
            [tool_response("calculate_budget", {"participants": 30})]
        )
        events: list[dict] = []

        result = run_agent("Plan the workshop", client=client, on_event=events.append)

        self.assertTrue(result.startswith("Stopped: calculate_budget:"))
        tool_result = next(
            event for event in events if event["type"] == "tool_result"
        )
        self.assertFalse(tool_result["ok"])
        self.assertIn("error", tool_result["result"])

    def test_only_next_workflow_tool_is_declared(self) -> None:
        client = FakeClient(HAPPY_RESPONSES)
        run_agent("Plan the workshop", client=client)

        first_tools = client.requests[0]["tools"]
        second_tools = client.requests[1]["tools"]

        self.assertEqual([tool.__name__ for tool in first_tools], ["calculate_budget"])
        self.assertEqual([tool.__name__ for tool in second_tools], ["check_resources"])
        self.assertNotIn("tools", client.requests[2])
        self.assertEqual(len(client.requests[2]["messages"]), 6)


if __name__ == "__main__":
    unittest.main()
