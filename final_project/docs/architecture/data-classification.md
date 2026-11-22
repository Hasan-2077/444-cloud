# Data Classification

## Measured or Forecast Values

Examples:
- Temperature
- Wind speed
- Visibility
- UV
- Humidity
- Rain amount/probability
- Snow amount/probability

Allowed Source:
Weather APIs only.

Rule:
Gemini must never provide these values.

---

## Derived Categories

Examples:
- Rain: Heavy / Mild / No
- Snow: Heavy / Mild / No

Allowed Source:
Application code only.

Rule:
Categories are computed using documented thresholds.

---

## Advice

Examples:
- Suggested road conditions
- Suggested dressing
- Suggested accessories

Allowed Source:
Gemini or application fallback logic.

Rule:
Advice may interpret weather facts but may not replace or alter them.

---

## Personal / User-Provided Data

Email:
- Used only for report delivery
- Not sent to Gemini
- Not logged
- Not stored unnecessarily

Clothing Category:
- Used only for clothing advice
- Fixed enum
- Not logged
- Not stored together with email

ZIP:
- Used to obtain location/weather data
- May be retained only as part of weather/report cache keys

Date:
- Used to select the requested forecast period
