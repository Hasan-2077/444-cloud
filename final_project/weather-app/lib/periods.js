'use strict';

var MORNING_HOURS = [6, 7, 8, 9, 10, 11];
var NIGHT_HOURS = [18, 19, 20, 21, 22, 23];

function containsHour(list, hour) {
  return list.indexOf(Number(hour)) !== -1;
}

function classifyHour(hour) {
  if (containsHour(MORNING_HOURS, hour)) {
    return 'morning';
  }

  if (containsHour(NIGHT_HOURS, hour)) {
    return 'night';
  }

  return null;
}

function selectPeriodRecords(records, period) {
  var hours;

  if (period === 'morning') {
    hours = MORNING_HOURS;
  } else if (period === 'night') {
    hours = NIGHT_HOURS;
  } else {
    throw new Error('Invalid period');
  }

  return records.filter(function (record) {
    return containsHour(hours, record.localHour);
  });
}

module.exports = {
  MORNING_HOURS: MORNING_HOURS,
  NIGHT_HOURS: NIGHT_HOURS,
  classifyHour: classifyHour,
  selectPeriodRecords: selectPeriodRecords
};
