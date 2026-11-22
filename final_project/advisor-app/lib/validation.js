'use strict';

var CLOTHING_CATEGORIES = [
  'menswear',
  'womenswear',
  'neutral'
];

function validateClothingCategory(
  value
) {
  if (
    CLOTHING_CATEGORIES.indexOf(
      value
    ) === -1
  ) {
    return {
      ok: false,
      error:
        'Invalid clothing category.'
    };
  }

  return {
    ok: true,
    value: value
  };
}

function normalizeEmail(email) {
  return String(email || '')
    .trim()
    .toLowerCase();
}

function validateEmail(email) {
  var value =
    normalizeEmail(email);

  if (
    !value ||
    value.length > 254
  ) {
    return {
      ok: false,
      error:
        'Invalid email address.'
    };
  }

  var emailPattern =
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (
    !emailPattern.test(value)
  ) {
    return {
      ok: false,
      error:
        'Invalid email address.'
    };
  }

  return {
    ok: true,
    value: value
  };
}

function validateZip(zip) {
  if (
    typeof zip !== 'string' ||
    !/^\d{5}$/.test(zip)
  ) {
    return {
      ok: false,
      error:
        'Enter a five-digit US ZIP code.'
    };
  }

  return {
    ok: true,
    value: zip
  };
}

function validateDate(
  dateString,
  todayString
) {
  if (
    typeof dateString !==
      'string' ||
    typeof todayString !==
      'string'
  ) {
    return {
      ok: false,
      error:
        'Date is required.'
    };
  }

  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(
      dateString
    )
  ) {
    return {
      ok: false,
      error:
        'Invalid calendar date.'
    };
  }

  var selected =
    new Date(
      dateString +
      'T00:00:00Z'
    );

  var today =
    new Date(
      todayString +
      'T00:00:00Z'
    );

  if (
    isNaN(selected.getTime()) ||
    isNaN(today.getTime())
  ) {
    return {
      ok: false,
      error:
        'Invalid calendar date.'
    };
  }

  if (
    selected
      .toISOString()
      .slice(0, 10) !==
    dateString
  ) {
    return {
      ok: false,
      error:
        'Invalid calendar date.'
    };
  }

  var days =
    Math.round(
      (
        selected.getTime() -
        today.getTime()
      ) / 86400000
    );

  if (
    days < 0 ||
    days > 6
  ) {
    return {
      ok: false,
      error:
        'Date must be within the next seven calendar days.'
    };
  }

  return {
    ok: true,
    value: dateString
  };
}

module.exports = {
  CLOTHING_CATEGORIES:
    CLOTHING_CATEGORIES,

  validateClothingCategory:
    validateClothingCategory,

  normalizeEmail:
    normalizeEmail,

  validateEmail:
    validateEmail,

  validateZip:
    validateZip,

  validateDate:
    validateDate
};
