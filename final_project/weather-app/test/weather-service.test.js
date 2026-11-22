'use strict';

var assert = require('assert');
var service = require('../lib/weather-service');

test('wind parser handles single value', function () {
  assert.strictEqual(
    service.parseWindSpeed('10 mph'),
    10
  );
});

test('wind parser uses maximum of range', function () {
  assert.strictEqual(
    service.parseWindSpeed('10 to 15 mph'),
    15
  );
});

test('wind parser returns null for missing value', function () {
  assert.strictEqual(
    service.parseWindSpeed(null),
    null
  );
});

test('Open-Meteo records are filtered by date', function () {
  var hourly = {
    time: [
      '2026-11-18T06:00',
      '2026-11-18T07:00',
      '2026-11-19T06:00'
    ],
    visibility: [10000, 12000, 9000],
    uv_index: [1, 2, 1],
    rain: [0, 1, 0],
    snowfall: [0, 0, 0]
  };

  var records =
    service.buildOpenMeteoRecords(
      hourly,
      '2026-11-18'
    );

  assert.strictEqual(records.length, 2);
  assert.strictEqual(records[0].localHour, 6);
});

test('period aggregation uses required rules', function () {
  var nws = [
    {
      temperature: 40,
      windMph: 10,
      humidity: 50,
      precipitationProbability: 10
    },
    {
      temperature: 50,
      windMph: 15,
      humidity: 70,
      precipitationProbability: 30
    }
  ];

  var open = [
    {
      visibilityMeters: 1609.344,
      uv: 2,
      rainMm: 0,
      snowfallCm: 0
    },
    {
      visibilityMeters: 804.672,
      uv: 4,
      rainMm: 1,
      snowfallCm: 2
    }
  ];

  var result =
    service.aggregatePeriod(
      nws,
      open
    );

  assert.deepStrictEqual(
    result.temperature,
    {
      min: 40,
      max: 50,
      unit: 'F',
      source: 'NWS'
    }
  );

  assert.strictEqual(result.wind.maxMph, 15);
  assert.strictEqual(result.humidity.averagePercent, 60);

  assert.ok(
    Math.abs(
      result.visibility.minMiles - 0.5
    ) < 0.001
  );

  assert.strictEqual(result.uv.maxIndex, 4);
  assert.strictEqual(result.rain.category, 'Mild');
  assert.strictEqual(result.snow.category, 'Mild');
});
