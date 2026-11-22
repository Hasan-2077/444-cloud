# Abuse Controls

## Gemini Abuse

Controls:
- Per-visitor rate limiting
- Global daily Gemini cap
- Atomic DynamoDB counter
- Rule-based fallback when the limit is reached

---

## Email Abuse

Controls:
- Per-visitor email request limit
- Only send to the submitted recipient
- SES recipient verification where required
- Do not expose unrestricted email-sending endpoints

---

## Repeated Requests

Controls:
- Weather-data cache
- Saved-report cache
- Do not call Gemini again for a fresh identical saved report

---

## Prompt Injection

Controls:
- No free-text input is sent to Gemini
- ZIP and date are validated
- Clothing category is an enum
- Weather facts are normalized before inclusion in the prompt
- Prompt structure is controlled entirely by application code

---

## Untrusted External Content

Controls:
- Validate every API response
- Validate Gemini's structured response
- Escape all values before HTML rendering
- Missing values are represented explicitly as unavailable
