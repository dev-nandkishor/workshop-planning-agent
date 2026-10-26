# Workshop Planning

## Purpose

Estimate the cost of a workshop and check whether named resources are available
in the local inventory. All costs are in INR.

## Required inputs

- `participants`: positive integer
- `days`: positive integer
- `daily_cost_per_person`: positive integer, in INR
- `budget`: positive integer, in INR
- `required_items`: comma-separated string of resource names

## Tools

1. `calculate_budget(participants, days, daily_cost_per_person, budget)`
   Calculates the exact total cost and compares it with the budget.
2. `check_resources(required_items)`
   Checks comma-separated resource names against the local inventory.

Use only the declared tools and never invent a tool or an argument.

## Workflow

1. Request `calculate_budget` once.
2. After it succeeds, request `check_resources` once.
3. Summarise both results in clear language.

Request exactly one tool per turn. Do not repeat a completed tool. Invoke tools
through the function-calling interface; never emit a tool call as JSON or
pseudo-code in the response text.

After `calculate_budget` succeeds, immediately request `check_resources`. Do not
write a partial summary while a required tool is still outstanding. Write the
final summary only after both tool results have been returned.

## Constraints

- Use INR only.
- Never guess missing input values.
- Do not invent inventory, equipment quantities, or availability. Treat the
  inventory result as authoritative.
- Report any missing equipment. Never claim that a missing item can be arranged.
- Report an over-budget result clearly.
- Do not describe calculations or inventory facts that did not come from a tool.

## Missing inputs and errors

Ask for missing inputs instead of inventing them. On a tool error, report the
error. Do not retry in the same run.
