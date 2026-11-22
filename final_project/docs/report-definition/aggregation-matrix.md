# Aggregation Matrix

| Report Item | Source | Period Aggregation | Display Unit |
|---|---|---|---|
| Temperature | NWS | Minimum and maximum | °F |
| Wind speed | NWS | Maximum sustained wind | mph |
| Visibility | Open-Meteo | Minimum visibility | miles |
| UV | Open-Meteo | Maximum UV index | UV index |
| Humidity | NWS | Arithmetic mean | % |
| Rain | Open-Meteo + NWS | Maximum hourly rain rate; NWS probability used as fallback | Heavy / Mild / No |
| Snow | Open-Meteo | Six-hour snowfall total | Heavy / Mild / No |
| Road conditions | Gemini / fallback | Advice from normalized weather facts | text |
| Dressing | Gemini / fallback | Advice from weather facts and clothing category | text |
| Accessories | Gemini / fallback | Advice from normalized weather facts | text |
