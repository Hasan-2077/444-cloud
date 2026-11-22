'use strict';

var HEAVY_RAIN_MM_PER_HOUR = 7.6;
var HEAVY_SNOW_CM_PER_PERIOD = 10.0;
var RAIN_PROBABILITY_FALLBACK_PERCENT = 20;

function isValidNumber(value) {
  return typeof value === 'number' && isFinite(value);
}

function classifyRain(maxHourlyRainMm, precipitationProbability) {
  var hasRainAmount = isValidNumber(maxHourlyRainMm);
  var hasProbability = isValidNumber(precipitationProbability);

  if (!hasRainAmount) {
    if (!hasProbability) {
      return 'Not Available';
    }

    return precipitationProbability >=
      RAIN_PROBABILITY_FALLBACK_PERCENT
      ? 'Mild'
      : 'No';
  }

  if (maxHourlyRainMm > HEAVY_RAIN_MM_PER_HOUR) {
    return 'Heavy';
  }

  if (maxHourlyRainMm > 0) {
    return 'Mild';
  }

  if (
    hasProbability &&
    precipitationProbability >=
      RAIN_PROBABILITY_FALLBACK_PERCENT
  ) {
    return 'Mild';
  }

  return 'No';
}

function classifySnow(periodSnowCm) {
  if (!isValidNumber(periodSnowCm)) {
    return 'Not Available';
  }

  if (periodSnowCm >= HEAVY_SNOW_CM_PER_PERIOD) {
    return 'Heavy';
  }

  if (periodSnowCm > 0) {
    return 'Mild';
  }

  return 'No';
}

module.exports = {
  HEAVY_RAIN_MM_PER_HOUR: HEAVY_RAIN_MM_PER_HOUR,
  HEAVY_SNOW_CM_PER_PERIOD: HEAVY_SNOW_CM_PER_PERIOD,
  RAIN_PROBABILITY_FALLBACK_PERCENT:
    RAIN_PROBABILITY_FALLBACK_PERCENT,
  classifyRain: classifyRain,
  classifySnow: classifySnow
};
