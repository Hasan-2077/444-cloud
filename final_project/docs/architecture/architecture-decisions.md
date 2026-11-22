# Architecture Decision Record

## Decision 1 - Tier Architecture

### Options Considered
- Single application tier
- Two application tiers
- Three or more tiers

### Decision
Use two application tiers:
1. Advisor tier
2. Weather Data tier

### Rationale
The two-tier architecture preserves separation of concerns between user-facing and AI functionality and external weather-data acquisition. It also allows the two services to have separate IAM roles, separate failure domains, independent scaling behavior, and a smaller security blast radius.

### Trade-offs
The design introduces an internal HTTP dependency between the Advisor and Weather tiers and requires two Auto Scaling Groups instead of one.

---

## Decision 2 — Application Language

### Options Considered
- Rewrite the application in Python
- Extend the existing Lab06 Node.js/Express applications

### Decision
Extend the existing Lab06 Node.js/Express applications.

### Rationale
The Lab06 applications already provide a functional base. Reusing them reduces unnecessary migration risk and allows the project effort to focus on distributed-system behavior, API normalization, security, resilience, Gemini integration, email delivery, and testing.

### Constraint
All infrastructure, deployment, bootstrapping, create/delete scripts, infrastructure testing, and budget logic remain Python.

---

## Decision 3 — Email Service

### Options Considered
- Amazon SNS
- Amazon SES

### Decision
Use Amazon SES.

### Rationale
The report contains structured Morning and Night sections and is better suited to an HTML email. SES also sends directly to one explicit recipient rather than relying on a shared publish-subscribe topic.

### Trade-offs
SES requires sender verification and may operate in sandbox mode during development.

---

## Decision 4 — Weather Cache

### Decision
Use a 15-minute freshness period for normalized weather facts.

### Rationale
Forecasts can change throughout the day. A short cache avoids unnecessary repeated API requests while keeping the report reasonably current.

---

## Decision 5 — Saved Report Cache

### Decision
Use the same 15-minute freshness period as the weather facts.

### Rationale
Advice should not remain cached longer than the weather facts that were used to generate it.

---

## Decision 6 — Gemini Responsibilities

### Decision
Gemini generates advice only.

Gemini may generate:
- Suggested road conditions
- Suggested dressing
- Suggested accessories

Gemini must not generate:
- Temperature
- Wind
- Visibility
- UV
- Humidity
- Rain amount
- Snow amount

### Rationale
Measured values must come from external weather data sources, while deterministic categories are computed by application code.

---

## Decision 7 — Gender Handling

### Decision
Use a fixed clothing-category enum:
- menswear
- womenswear
- neutral

### Rationale
The value is used only to tailor clothing recommendations. No free-text identity field is required.

### Privacy
The clothing category is not logged and is never stored together with the user's email address.

---

## Decision 8 — Secret Management

### Decision
Store the Gemini API key only in AWS Systems Manager Parameter Store as a SecureString.

### Rationale
The key must not appear in source code, .env files, user-data, logs, screenshots, or application responses.

---

## Decision 9 — IAM Structure

### Decision
Use separate least-privilege IAM roles for the Advisor and Weather tiers.

### Rationale
Each service should receive only the permissions required for its own responsibilities.

---

## Decision 10 — Data Persistence

### Decision
Use DynamoDB for:
- normalized weather facts
- saved reports
- Gemini daily-call counter

### Privacy
Email addresses are not stored in DynamoDB.
