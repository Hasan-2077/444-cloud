# Weather Data Source Map

| Output | Period | Source | Endpoint | Exact Field | Unit | Real Example | Horizon | Resolution | Gap Handling |
|---|---|---|---|---|---|---|---|---|---|
| Temperature | Morning | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD |
| Temperature | Night | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD |
| Wind speed | Morning | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD |
| Wind speed | Night | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD |
| Visibility | Morning | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD |
| Visibility | Night | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD |
| UV | Morning | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD |
| UV | Night | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD |
| Humidity | Morning | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD |
| Humidity | Night | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD |
| Rain | Morning | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD |
| Rain | Night | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD |
| Snow | Morning | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD |
| Snow | Night | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD |

## Source Precedence

1. NWS is the authoritative primary source for US forecast facts where usable data is available.
2. Open-Meteo supplements fields that were missing or incomplete in the real NWS response.
3. Application code computes Rain and Snow categories deterministically.
4. Gemini generates advice only and never replaces authoritative measured values.

## Missing Data Policy

A missing field is never converted to zero unless zero is explicitly present in the source response.

If a field is unavailable:
- the report displays `Not Available`
- the source/reason is recorded where practical
- unrelated report fields continue normally
- Gemini/fallback advice must not rely on the missing value
