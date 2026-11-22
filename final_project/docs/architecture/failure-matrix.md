# Failure Behavior Matrix

| Failure | System Behavior | User Behavior |

| ZIP is not exactly five digits | Stop before any external call | Explain US-only five-digit ZIP requirement |
| Valid format ZIP does not exist | Stop weather workflow | Display ZIP code not found |
| NWS unavailable | Use recent cached data if available | Show cached-data age; otherwise weather unavailable |
| Supplemental weather API unavailable | Continue where possible | Missing field shows Not Available |
| Weather field missing | Preserve remaining report | Show Not Available with reason |
| Gemini API error | Use rule-based advice | Label advice as fallback |
| Gemini malformed output | Reject Gemini result and use fallback | Report still displays |
| Gemini daily cap reached | Do not call Gemini | Use fallback advice |
| SSM unavailable | Gemini cannot be called | Use fallback advice |
| SES unavailable | Do not claim success | Tell user sending failed |
| Email address rejected | Record failure only | Tell user address/send failed |
| Advisor instance terminated | ASG replaces instance | Request may be retried |
| Weather instance terminated | ASG replaces instance | Temporary weather-service delay |
| External request timeout | Abort before ALB timeout | Show dependency-specific degraded state |
| DynamoDB unavailable | Skip cache where possible | Continue or report temporary service problem |
