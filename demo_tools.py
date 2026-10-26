"""Direct unit validation for tools without LLM involvement."""

from tools import calculate_budget, check_resources

# 1. Test budget calculation.
result = calculate_budget(30, 2, 200, 15000)
assert result["total_estimated_cost"] == 12000
assert result["remaining_budget"] == 3000
assert result["within_budget"] is True

# Deficit scenario.
result = calculate_budget(30, 2, 200, 10000)
assert result["remaining_budget"] == -2000
assert result["within_budget"] is False

# 2. Test resource checking and aliasing.
result = check_resources("beamer, WIFI, wifi, microphones")
assert result == {
    "available": ["projector", "wi-fi"],
    "missing": ["microphones"],
}

# 3. Guardrail verification: reject non-integers and booleans.
for bad in (True, 0, -1, "30", 1.5, 1_000_001):
    try:
        calculate_budget(bad, 2, 200, 15000)
    except ValueError:
        pass
    else:
        raise AssertionError(f"Invalid input {bad!r} was unexpectedly accepted")

# Reject an empty resource string.
try:
    check_resources(" , , ")
except ValueError:
    pass
else:
    raise AssertionError("Empty resource list was unexpectedly accepted")

# Reject non-string resource input.
try:
    check_resources(["projector"])
except ValueError:
    pass
else:
    raise AssertionError("Non-string resource input was unexpectedly accepted")

print("All direct tool checks passed successfully.")
