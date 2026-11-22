'use strict';

function compactPeriod(period) {
  return {
    temperature:
      period &&
      period.temperature
        ? {
            min:
              period.temperature.min,
            max:
              period.temperature.max,
            unit:
              period.temperature.unit
          }
        : null,

    windMph:
      period &&
      period.wind
        ? period.wind.maxMph
        : null,

    visibilityMiles:
      period &&
      period.visibility
        ? period.visibility.minMiles
        : null,

    uv:
      period &&
      period.uv
        ? period.uv.maxIndex
        : null,

    humidityPercent:
      period &&
      period.humidity
        ? period.humidity.averagePercent
        : null,

    rain:
      period &&
      period.rain
        ? period.rain.category
        : 'Not Available',

    snow:
      period &&
      period.snow
        ? period.snow.category
        : 'Not Available'
  };
}

function buildAdvicePrompt(
  weather,
  clothingCategory
) {
  var payload = {
    date: weather.date,

    location: {
      city:
        weather.location.city,

      state:
        weather.location.state
    },

    clothingCategory:
      clothingCategory,

    morning:
      compactPeriod(
        weather.morning
      ),

    night:
      compactPeriod(
        weather.night
      )
  };

  return [
    'You are a weather-advice assistant.',
    '',
    'Use only the supplied weather facts.',
    'Do not invent or change measured weather values.',
    'Do not repeat an email address or other personal information.',
    '',
    'Return JSON only.',
    '',
    'Required shape:',
    '{',
    '  "morning": {',
    '    "road_conditions": "string",',
    '    "dressing": "string",',
    '    "accessories": "string"',
    '  },',
    '  "night": {',
    '    "road_conditions": "string",',
    '    "dressing": "string",',
    '    "accessories": "string"',
    '  }',
    '}',
    '',
    'Keep every field practical and concise.',
    '',
    'Weather facts:',
    JSON.stringify(payload)
  ].join('\n');
}

module.exports = {
  compactPeriod: compactPeriod,
  buildAdvicePrompt:
    buildAdvicePrompt
};
