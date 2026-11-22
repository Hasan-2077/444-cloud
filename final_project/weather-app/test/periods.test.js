'use strict';

var assert = require('assert');
var periods = require('../lib/periods');

test('06:00 is morning', function () {
  assert.strictEqual(periods.classifyHour(6), 'morning');
});

test('11:00 is morning', function () {
  assert.strictEqual(periods.classifyHour(11), 'morning');
});

test('05:00 is outside morning', function () {
  assert.strictEqual(periods.classifyHour(5), null);
});

test('12:00 is outside morning', function () {
  assert.strictEqual(periods.classifyHour(12), null);
});

test('18:00 is night', function () {
  assert.strictEqual(periods.classifyHour(18), 'night');
});

test('23:00 is night', function () {
  assert.strictEqual(periods.classifyHour(23), 'night');
});

test('17:00 is outside night', function () {
  assert.strictEqual(periods.classifyHour(17), null);
});

test('00:00 is outside night', function () {
  assert.strictEqual(periods.classifyHour(0), null);
});

test('selectPeriodRecords returns six morning records', function () {
  var records = [];

  for (var hour = 0; hour < 24; hour += 1) {
    records.push({ localHour: hour });
  }

  assert.strictEqual(
    periods.selectPeriodRecords(records, 'morning').length,
    6
  );
});

test('selectPeriodRecords returns six night records', function () {
  var records = [];

  for (var hour = 0; hour < 24; hour += 1) {
    records.push({ localHour: hour });
  }

  assert.strictEqual(
    periods.selectPeriodRecords(records, 'night').length,
    6
  );
});
