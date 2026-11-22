#!/usr/bin/env python3

STACK_COST_PER_HOUR = 0.07
PROJECT_BUDGET = 2.00

# Final project usage recorded from build/test sessions.
STACK_HOURS = 4.0
GEMINI_CALLS = 2

stack_cost = STACK_HOURS * STACK_COST_PER_HOUR

print("=== Weather Advisor Final Project Cost Report ===")
print()
print(f"Stack runtime: {STACK_HOURS:.2f} hours")
print(f"Estimated stack rate: ${STACK_COST_PER_HOUR:.2f}/hour")
print(f"Estimated stack cost: ${stack_cost:.2f}")
print()
print(f"Gemini calls recorded: {GEMINI_CALLS}")
print("Gemini estimated cost: $0.00 (free tier)")
print("NWS cost: $0.00")
print("Open-Meteo cost: $0.00")
print("DynamoDB / SSM / SES estimated cost: effectively $0.00 at project scale")
print()
print(f"Estimated total project cost: ${stack_cost:.2f}")
print(f"Project budget: ${PROJECT_BUDGET:.2f}")
print(f"Budget remaining: ${PROJECT_BUDGET - stack_cost:.2f}")
print()
print(
    "Budget status:",
    "PASS" if stack_cost < PROJECT_BUDGET else "OVER BUDGET"
)
