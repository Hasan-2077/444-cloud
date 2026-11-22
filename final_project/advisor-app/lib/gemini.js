'use strict';

var REQUIRED_PERIOD_FIELDS = [
  'road_conditions',
  'dressing',
  'accessories'
];

var REQUIRED_PERIODS = [
  'morning',
  'night'
];

var MAX_FIELD_LENGTH = 500;

function validateAdvicePeriod(value) {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value)
  ) {
    return {
      ok: false,
      error:
        'Advice period must be an object.'
    };
  }

  var keys =
    Object.keys(value);

  if (
    keys.length !==
    REQUIRED_PERIOD_FIELDS.length
  ) {
    return {
      ok: false,
      error:
        'Advice period has invalid fields.'
    };
  }

  for (
    var i = 0;
    i < REQUIRED_PERIOD_FIELDS.length;
    i += 1
  ) {
    var field =
      REQUIRED_PERIOD_FIELDS[i];

    if (
      keys.indexOf(field) === -1
    ) {
      return {
        ok: false,
        error:
          'Advice period has invalid fields.'
      };
    }

    var text =
      value[field];

    if (
      typeof text !== 'string' ||
      text.trim().length === 0 ||
      text.length > MAX_FIELD_LENGTH
    ) {
      return {
        ok: false,
        error:
          'Invalid ' + field + '.'
      };
    }

    if (/<[^>]*>/.test(text)) {
      return {
        ok: false,
        error:
          'HTML is not allowed in ' +
          field +
          '.'
      };
    }
  }

  return {
    ok: true,
    value: value
  };
}

function validateGeminiAdvice(value) {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value)
  ) {
    return {
      ok: false,
      error:
        'Gemini response must be an object.'
    };
  }

  var keys =
    Object.keys(value);

  if (
    keys.length !==
    REQUIRED_PERIODS.length
  ) {
    return {
      ok: false,
      error:
        'Gemini response must contain morning and night.'
    };
  }

  for (
    var i = 0;
    i < REQUIRED_PERIODS.length;
    i += 1
  ) {
    var period =
      REQUIRED_PERIODS[i];

    if (
      keys.indexOf(period) === -1
    ) {
      return {
        ok: false,
        error:
          'Gemini response must contain morning and night.'
      };
    }

    var checked =
      validateAdvicePeriod(
        value[period]
      );

    if (!checked.ok) {
      return checked;
    }
  }

  return {
    ok: true,
    value: value
  };
}

module.exports = {
  REQUIRED_PERIOD_FIELDS:
    REQUIRED_PERIOD_FIELDS,

  REQUIRED_PERIODS:
    REQUIRED_PERIODS,

  MAX_FIELD_LENGTH:
    MAX_FIELD_LENGTH,

  validateAdvicePeriod:
    validateAdvicePeriod,

  validateGeminiAdvice:
    validateGeminiAdvice
};
