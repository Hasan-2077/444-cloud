# Request Flows

## Flow 1 — Build a Weather Report

1. The browser submits:
   - date
   - ZIP code
   - clothing category
   - email address

2. The Advisor performs server-side validation.

3. If validation fails, the request stops immediately.

4. The Advisor checks DynamoDB for a fresh saved report using:
   - ZIP
   - date
   - clothing category

5. If a fresh report exists, it is returned immediately.

6. Otherwise, the Advisor requests normalized weather facts from the Weather Data tier.

7. The Weather tier:
   - resolves ZIP to coordinates
   - determines the local timezone
   - checks its weather cache
   - calls external weather APIs if needed
   - selects Morning and Night periods
   - normalizes values
   - computes rain/snow categories
   - stores the normalized result in DynamoDB

8. The Weather tier returns normalized facts to the Advisor.

9. The Advisor checks the Gemini daily-call counter.

10. If Gemini usage is allowed:
    - retrieve Gemini key from SSM
    - build the structured prompt
    - call Gemini
    - validate the returned structure

11. If Gemini fails or the cap is reached:
    - generate rule-based fallback advice

12. The Advisor combines:
    - authoritative weather facts
    - deterministic categories
    - advice

13. The completed report is saved temporarily.

14. The report is rendered to the user.

---

## Flow 2 — Email the Report

1. User clicks Email Report.

2. Advisor checks:
   - report identifier
   - recipient address
   - email request rate limit

3. Advisor prepares the email from the already-generated report.

4. Advisor sends the message using SES.

5. SES response is checked.

6. User sees one of:
   - sent
   - verification required
   - rate limited
   - failed

7. The application does not claim success until SES accepts the request.
