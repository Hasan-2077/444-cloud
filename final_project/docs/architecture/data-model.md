# DynamoDB Data Model

## Entity 1 - Weather Facts

Primary Key Concept:

WEATHER#<ZIP>#<DATE>

Example:

WEATHER#60616#2026-11-18

Attributes:
- zip
- date
- city
- state
- latitude
- longitude
- timezone
- morning_facts
- night_facts
- source_metadata
- generated_at
- expires_at

TTL:
15 minutes from generation.

---

## Entity 2 — Saved Report

Primary Key Concept:

REPORT#<ZIP>#<DATE>#<CLOTHING_CATEGORY>

Example:

REPORT#60616#2026-11-18#neutral

Attributes:
- weather facts
- morning advice
- night advice
- advice source
- generated_at
- expires_at

The user's email address is not stored in this entity.

TTL:
15 minutes.

---

## Entity 3 — Gemini Daily Counter

Primary Key Concept:

GEMINI_CALLS#<DATE>

Example:

GEMINI_CALLS#2026-11-18

Attributes:
- count
- expires_at

Updates:
Atomic increments only.

Purpose:
Prevent the application from exhausting the Gemini daily limit.
