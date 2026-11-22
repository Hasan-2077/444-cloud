# Weather Advisor Report Definition

## 1. Supported Date Range

Users may choose:
- today
- today + 1 day
- today + 2 days
- today + 3 days
- today + 4 days
- today + 5 days
- today + 6 days

All date calculations use the local timezone of the ZIP-code location.

If today is selected after the Morning window has already passed, the Morning section may still display forecast data for that earlier local period if the source provides it. The interface will clearly label the selected date and periods.

---

## 2. Morning Period

Morning is defined as:

06:00 through 11:59 local time

This period contains six hourly observations:
06:00
07:00
08:00
09:00
10:00
11:00

---

## 3. Night Period

Night is defined as:

18:00 through 23:59 local time

This period contains six hourly observations:
18:00
19:00
20:00
21:00
22:00
23:00

The period does not cross midnight.

---

## 4. Timezone Handling

The NWS `/points` response supplies the timezone for the ZIP-code location.

All selected dates and Morning/Night windows are interpreted in that timezone.

UTC and server-local time are not used to determine the report periods.

Daylight Saving Time transitions are handled using timezone-aware date/time operations.

---

## 5. Temperature

Source:
NWS hourly temperature

Report value:
Minimum and maximum temperature observed during the period.

Display format:

Low: XX °F
High: XX °F

Reason:
A range represents changing conditions across the six-hour period better than a single midpoint or average.

---

## 6. Wind Speed

Source:
NWS hourly `windSpeed`

Report value:
Maximum sustained wind speed during the period.

Unit:
mph

If gust information is available and materially higher than sustained wind, the report may also show the maximum gust separately.

Reason:
Maximum wind is more useful for practical clothing, travel, and safety advice than an average.

---

## 7. Visibility

Source:
Open-Meteo hourly `visibility`

Report value:
Lowest visibility observed during the period.

Source unit:
meters

Display unit:
miles

Reason:
The lowest visibility represents the worst expected driving/travel condition during the period.

If no usable visibility value exists:

Not Available

---

## 8. UV Index

Source:
Open-Meteo hourly `uv_index`

Report value:
Maximum UV index during the period.

Reason:
Peak UV is more relevant for sunscreen and sun-protection advice than the average.

For Night:
A valid reported value of 0 is displayed as 0.

If the source provides no value:

Not Available

---

## 9. Humidity

Source:
NWS `relativeHumidity`

Report value:
Average relative humidity during the period.

Unit:
percent

Reason:
Humidity normally varies gradually across the period, so an average provides a useful summary.

---

## 10. Rain

Measured inputs:
- NWS `probabilityOfPrecipitation`
- Open-Meteo hourly rain amount

The application code derives:
- No
- Mild
- Heavy

The model does not determine this category.

Exact thresholds are defined separately in `precipitation-thresholds.md`.

---

## 11. Snow

Measured input:
Open-Meteo hourly `snowfall`

The application code derives:
- No
- Mild
- Heavy

The model does not determine this category.

Exact thresholds are defined separately in `precipitation-thresholds.md`.

---

## 12. Suggested Road Conditions

Source:
Gemini or application fallback logic

Inputs may include:
- temperature
- rain category
- snow category
- visibility
- wind

The result must be short, practical, and must not invent weather facts.

---

## 13. Suggested Dressing

Source:
Gemini or application fallback logic

Inputs may include:
- temperature
- wind
- humidity
- rain
- snow
- clothing category

Allowed clothing categories:
- menswear
- womenswear
- neutral

---

## 14. Suggested Accessories

Source:
Gemini or application fallback logic

Inputs may include:
- rain
- snow
- UV
- temperature
- wind

Examples:
- umbrella
- sunglasses
- sunscreen
- gloves
- scarf

---

## 15. Missing Data

Missing values are never converted to zero.

If a source does not provide a value:

Not Available

The rest of the report continues normally.

Gemini and fallback advice must not rely on a field marked unavailable.
