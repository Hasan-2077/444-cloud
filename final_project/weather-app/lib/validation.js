'use strict';

function validateZip(zip) {
  if (
    typeof zip !== 'string' ||
    !/^\d{5}$/.test(zip)
  ) {
    return {
      ok: false,
      error:
        'This service supports five-digit US ZIP codes only.'
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
    typeof dateString !== 'string' ||
    typeof todayString !== 'string'
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

function dateStringInTimeZone(
  timeZone,
  nowMs
) {
  var date =
    new Date(
      typeof nowMs === 'number'
        ? nowMs
        : Date.now()
    );

  var parts =
    new Intl.DateTimeFormat(
      'en-US',
      {
        timeZone: timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      }
    ).formatToParts(date);

  var values = {};

  parts.forEach(
    function (part) {
      values[part.type] =
        part.value;
    }
  );

  return (
    values.year +
    '-' +
    values.month +
    '-' +
    values.day
  );
}

function validateDateForTimeZone(
  dateString,
  timeZone,
  nowMs
) {
  var localToday =
    dateStringInTimeZone(
      timeZone,
      nowMs
    );

  return validateDate(
    dateString,
    localToday
  );
}

module.exports = {
  validateZip:
    validateZip,

  validateDate:
    validateDate,

  dateStringInTimeZone:
    dateStringInTimeZone,

  validateDateForTimeZone:
    validateDateForTimeZone
};
