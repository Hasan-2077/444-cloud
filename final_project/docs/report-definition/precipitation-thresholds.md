# Rain and Snow Classification Rules

## Rain Classification

Source:
Open-Meteo hourly `rain`

Supporting source:
NWS `probabilityOfPrecipitation`

Rain intensity is classified using the maximum hourly rain amount observed during the selected Morning or Night period.

### No Rain

Maximum hourly rain = 0 mm

and precipitation probability is below 20%.

### Mild Rain

Maximum hourly rain > 0 mm and <= 7.6 mm/hour.

If rain amount is unavailable but NWS precipitation probability is at least 20%, the period is classified as Mild.

### Heavy Rain

Maximum hourly rain > 7.6 mm/hour.

Heavy Rain is never inferred from precipitation probability alone.

### Published Basis

NOAA precipitation-intensity guidance identifies heavy rain at approximately more than 0.30 inches per hour, which is approximately 7.6 mm/hour.

### Missing Rain Data

If measured rain amount is unavailable:

- precipitation probability below 20% -> No
- precipitation probability at least 20% -> Mild

If both measured amount and precipitation probability are unavailable:

Not Available

---

## Snow Classification

Source:
Open-Meteo hourly `snowfall`

Period snowfall is calculated as the sum of hourly snowfall during the selected six-hour period.

### No Snow

Period snowfall = 0 cm

### Mild Snow

Period snowfall > 0 cm and < 10 cm

### Heavy Snow

Period snowfall >= 10 cm during the six-hour period.

### Published Basis

NOAA/NWS guidance commonly identifies heavy snow as approximately 10 cm or more accumulated within 12 hours.

Because the application reports six-hour Morning and Night periods, 10 cm within one report period is used as a conservative Heavy threshold. A snowfall amount that reaches the published 12-hour heavy-snow threshold within only six hours clearly represents significant snowfall.

### Missing Snow Data

If snowfall data is unavailable:

Not Available

Missing snowfall must never be interpreted as zero.

---

## Boundary Requirements

### Rain

Test:

- 0 mm/hour
- just above 0
- just below 7.6 mm/hour
- exactly 7.6 mm/hour
- just above 7.6 mm/hour
- precipitation probability 19%
- precipitation probability 20%
- amount unavailable
- probability unavailable
- both unavailable

### Snow

Test:

- 0 cm
- just above 0 cm
- just below 10 cm
- exactly 10 cm
- just above 10 cm
- snowfall unavailable
