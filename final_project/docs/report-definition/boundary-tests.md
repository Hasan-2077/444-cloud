# Required Boundary Tests

## Date

Test:
- yesterday
- today
- today + 6 days
- today + 7 days
- impossible calendar date

## Morning Period

Test:
- 05:59
- 06:00
- 11:59
- 12:00

## Night Period

Test:
- 17:59
- 18:00
- 23:59
- 00:00

## Rain Amount

Test:
- 0 mm
- just above 0 mm
- just below 7.6 mm/hour
- exactly 7.6 mm/hour
- just above 7.6 mm/hour

## Rain Probability Fallback

Test:
- 19%
- 20%
- amount missing
- probability missing
- both missing

## Snow

Test:
- 0 cm
- just above 0 cm
- just below 10 cm
- exactly 10 cm
- just above 10 cm

## Missing Data

Individually test missing:
- temperature
- wind
- visibility
- UV
- humidity
- rain
- snow

Expected behavior:

`Not Available`

Missing values must never silently become zero.
