# Threat Table

| Threat | Asset at Risk | Control |

| Gemini API key exposure | Gemini credential | Store only in SSM SecureString |
| Direct access to EC2 app port | Application instances | Security group accepts app traffic only from ALB |
| Unauthorized SES sending | Email service | Advisor-only SES IAM permission |
| Email abuse | Recipients / SES quota | Per-visitor rate limit |
| Gemini quota exhaustion | Gemini availability | Daily cap and per-visitor limit |
| Prompt injection | Gemini output | No user free text in prompts |
| XSS from Gemini output | Browser | Validate and HTML-escape output |
| Malicious external API response | Application/browser | Validate and escape all external values |
| Cross-user report delivery | User privacy | Explicit recipient binding |
| Sensitive logging | Email/gender privacy | Never log email or clothing category |
| Stale forecast data | Report correctness | 15-minute cache freshness |
| Missing API fields interpreted as zero | Report correctness | Explicit Not Available representation |
| Compromised Advisor tier | Gemini secret / SES | Least-privilege Advisor role |
| Compromised Weather tier | Weather cache | Weather role has no Gemini or email permission 
