# Unit Normalization

## Temperature

NWS temperature is displayed in degrees Fahrenheit.

## Wind Speed

NWS sustained wind is displayed in miles per hour.

## Visibility

Open-Meteo returns visibility in meters.

The application converts it to miles for display:

miles = meters / 1609.344

## UV Index

The Open-Meteo UV index is displayed using its source value.

## Humidity

Relative humidity is displayed as a percentage.

## Rain

Open-Meteo rain amounts remain in millimeters for classification.

## Snow

Open-Meteo snowfall amounts remain in centimeters for classification.

## Rule

Calculations use source-native units whenever possible. Conversion occurs only when required for consistent classification or user-friendly display.
