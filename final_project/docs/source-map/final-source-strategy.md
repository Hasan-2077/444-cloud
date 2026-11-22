# Final Weather Source Strategy

## Temperature
Primary source: NWS hourly forecast

Reason:
NWS provides hourly temperature values across the required forecast window.

## Wind Speed
Primary source: NWS hourly forecast

Reason:
NWS provides hourly sustained wind values and direction.

## Humidity
Primary source: NWS hourly forecast

Reason:
NWS provides relative humidity in the hourly forecast.

## Visibility
Primary source: Open-Meteo

Reason:
The tested NWS grid response exposed the visibility field but returned an empty values array. Open-Meteo returned populated hourly visibility values across the full seven-day forecast.

## UV Index
Primary source: Open-Meteo

Reason:
No usable UV field was found in the tested NWS forecast or grid response. Open-Meteo provides hourly UV index values.

## Precipitation Probability
Primary source: NWS

Reason:
NWS provides probabilityOfPrecipitation in both hourly and grid forecast data.

## Rain Amount
Primary source: Open-Meteo
Secondary source: NWS quantitativePrecipitation when complete

Reason:
The tested NWS grid response did not populate quantitative precipitation across the full seven-day window. Open-Meteo provides hourly rain values across the full period.

## Snow Amount
Primary source: Open-Meteo
Secondary source: NWS snowfallAmount when complete

Reason:
The tested NWS grid response did not populate snowfall amount across the full seven-day window. Open-Meteo provides hourly snowfall values across the full period.

## Rain Category
Source: Application code

The Heavy / Mild / No category will be derived deterministically from measured rain data using documented thresholds.

## Snow Category
Source: Application code

The Heavy / Mild / No category will be derived deterministically from measured snowfall data using documented thresholds.

## Road Conditions
Source: Gemini or rule-based fallback

Gemini receives only normalized weather facts.

## Clothing Advice
Source: Gemini or rule-based fallback

Gemini also receives the validated clothing category.

## Accessories
Source: Gemini or rule-based fallback

Gemini receives only normalized weather facts.
