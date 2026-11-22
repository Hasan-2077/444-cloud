# Component Responsibilities

## Application Load Balancer

Responsibilities:
- Public entry point
- Route Advisor traffic on port 8081
- Route Weather traffic on port 8080
- Perform target health checks

Must Not:
- Expose the EC2 application port directly to the internet

---

## Advisor Tier

Responsibilities:
- Serve the web form
- Validate user input
- Check for an existing fresh report
- Request normalized weather facts from the Weather tier
- Enforce the Gemini daily call limit
- Retrieve the Gemini API key from SSM
- Build Gemini prompts
- Validate Gemini responses
- Generate the final report page
- Save completed reports temporarily
- Handle email delivery through SES
- Return degraded-state information when dependencies fail

Must Not:
- Call weather APIs directly
- Invent measured weather values
- Store long-term email addresses
- Store long-term gender information

---

## Weather Data Tier

Responsibilities:
- Validate service-level ZIP/date requests
- Convert ZIP codes to coordinates
- Determine local timezone
- Call NWS
- Call supplemental weather data sources
- Normalize API responses
- Select Morning and Night windows
- Aggregate measurements
- Compute rain and snow categories
- Record data provenance
- Cache normalized facts in DynamoDB

Must Not:
- Call Gemini
- Send email
- Receive the user's email address
- Receive the user's clothing category

---

## DynamoDB

Responsibilities:
- Store cached weather facts
- Store temporary completed reports
- Store the Gemini daily call counter
- Expire temporary data using TTL

Must Not:
- Store user email addresses longer than required
- Store unnecessary personal data

---

## SSM Parameter Store

Responsibilities:
- Store the Gemini API key as SecureString

Must Not:
- Be readable by the Weather role

---

## Gemini API

Responsibilities:
- Generate road advice
- Generate clothing advice
- Generate accessory advice

Must Not:
- Supply authoritative measured weather values
- Receive email addresses
- Receive arbitrary user free text

---

## Amazon SES

Responsibilities:
- Send a completed report to the requested recipient

Must Not:
- Send one user's report to a different recipient
