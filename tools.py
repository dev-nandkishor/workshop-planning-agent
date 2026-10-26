"""Exact arithmetic and inventory checks for the workshop agent."""

from __future__ import annotations

INVENTORY: dict[str, set[str]] = {
    "projector": {"projector", "projectors", "beamer"},
    "wi-fi": {"wi-fi", "wifi", "wi fi", "wireless", "internet"},
    "whiteboard": {"whiteboard", "white board", "whiteboards"},
    "laptops": {"laptops", "laptop", "notebooks"},
}

_ALIAS_TO_CANONICAL = {
    alias: canonical for canonical, aliases in INVENTORY.items() for alias in aliases
}

_MAX_INT = 1_000_000


def _require_positive_int(name: str, value: int) -> int:
    """Accept integers from 1 to 1,000,000, strictly excluding booleans."""
    if type(value) is not int or not 1 <= value <= _MAX_INT:
        raise ValueError(f"{name} must be an integer from 1 to 1,000,000")
    return value


def calculate_budget(
    participants: int,
    days: int,
    daily_cost_per_person: int,
    budget: int,
) -> dict:
    """Calculate workshop cost in INR and compare it against budget.

    Args:
        participants: Number of attendees.
        days: Number of workshop days.
        daily_cost_per_person: Cost per attendee per day in INR.
        budget: Total available budget in INR.

    Returns:
        dict: Exact total cost, remaining budget, and budget status.
    """
    p = _require_positive_int("participants", participants)
    d = _require_positive_int("days", days)
    c = _require_positive_int("daily_cost_per_person", daily_cost_per_person)
    b = _require_positive_int("budget", budget)

    total = p * d * c
    return {
        "currency": "INR",
        "total_estimated_cost": total,
        "budget": b,
        "remaining_budget": b - total,
        "within_budget": total <= b,
    }


def check_resources(required_items: str) -> dict:
    """Look up comma-separated items against local inventory aliases.

    Args:
        required_items: Comma-separated resource names to check.

    Returns:
        dict: Canonical available resources and unrecognised missing items.
    """
    if not isinstance(required_items, str):
        raise ValueError("required_items must be a string")

    tokens = [item.strip() for item in required_items.split(",")]
    tokens = [item for item in tokens if item]
    if not tokens:
        raise ValueError("Provide at least one resource name")

    available: list[str] = []
    missing: list[str] = []
    seen: set[str] = set()

    for raw in tokens:
        cleaned = " ".join(raw.lower().split())
        canonical = _ALIAS_TO_CANONICAL.get(cleaned)
        key = canonical or cleaned
        if key in seen:
            continue
        seen.add(key)

        if canonical:
            available.append(canonical)
        else:
            missing.append(raw)

    return {"available": available, "missing": missing}
