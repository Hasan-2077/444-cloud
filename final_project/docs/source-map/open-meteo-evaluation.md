# Open-Meteo Supplemental Source Evaluation

## Purpose

Open-Meteo is used only where the primary National Weather Service source has a demonstrated gap or incomplete field.

## Gaps Addressed

- Visibility
- UV index
- Rain amount when NWS amount data is unavailable
- Snowfall amount when NWS amount data is unavailable

## Forecast Horizon

The API provides hourly forecast data across the full seven-day period required by the application.

## Resolution

Hourly resolution is sufficient for the application's Morning and Night aggregation windows.

## Units Observed

- Visibility: meters
- UV index: unitless index
- Precipitation: millimeters
- Rain: millimeters
- Snowfall: centimeters
- Wind speed: kilometers per hour

## Authentication

The selected Open-Meteo endpoint does not require an API key for the planned project use.

## Failure Behavior

NWS remains the primary weather source.

If a supplemental Open-Meteo value is unavailable:

- The application must not replace the missing value with zero.
- The field is displayed as `Not Available`.
- Advice generation must not rely on the missing value.
- The rest of the report continues normally.

## Decision

Open-Meteo is selected as the supplemental source because it fills gaps observed in the real NWS responses while preserving hourly resolution and the required seven-day forecast horizon.
