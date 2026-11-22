# API Gap Analysis

## NWS Findings

The National Weather Service remains the primary weather source because it provides authoritative US forecast data and covers temperature, wind, relative humidity, precipitation probability, and other forecast information required by the application.

However, the real 60616 test response revealed several gaps.

### Visibility

The NWS grid response exposed a `visibility` field, but the real response contained an empty `values` array. Therefore, the application cannot assume that NWS visibility data will be available.

### UV Index

No UV or ultraviolet field was present in the tested NWS grid response.

### Rain and Snow Amounts

The NWS grid response exposed `quantitativePrecipitation` and `snowfallAmount`, but their populated values did not consistently extend across the entire selectable seven-calendar-day window.

## Supplemental Source Decision

Open-Meteo will be evaluated as the supplemental forecast source for:

- Visibility
- UV index
- Rain amount when NWS amount data is unavailable
- Snowfall amount when NWS amount data is unavailable

NWS remains the primary source wherever it provides usable authoritative data.
