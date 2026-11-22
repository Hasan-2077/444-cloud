'use strict';

var assert = require('assert');
var fallback = require('../lib/fallback');

test('cold weather recommends warm layers', function () {
  var result = fallback.fallbackAdvice(
    {
      temperature: { min: 25, max: 32 },
      rain: 'No',
      snow: 'No',
      visibilityMiles: 10,
      uv: 1,
      windMph: 5
    },
    'neutral'
  );

  assert.ok(
    result.dressing.indexOf('warm layers') !== -1
  );
});

test('rain recommends umbrella', function () {
  var result = fallback.fallbackAdvice(
    {
      temperature: { min: 50, max: 55 },
      rain: 'Mild',
      snow: 'No',
      visibilityMiles: 10,
      uv: 1,
      windMph: 5
    },
    'menswear'
  );

  assert.ok(
    result.accessories.indexOf('umbrella') !== -1
  );
});

test('high UV recommends sunscreen and sunglasses', function () {
  var result = fallback.fallbackAdvice(
    {
      temperature: { min: 70, max: 80 },
      rain: 'No',
      snow: 'No',
      visibilityMiles: 10,
      uv: 6,
      windMph: 5
    },
    'womenswear'
  );

  assert.ok(
    result.accessories.indexOf('sunscreen') !== -1
  );

  assert.ok(
    result.accessories.indexOf('sunglasses') !== -1
  );
});

test('poor visibility affects road advice', function () {
  var result = fallback.fallbackAdvice(
    {
      temperature: { min: 60, max: 65 },
      rain: 'No',
      snow: 'No',
      visibilityMiles: 2,
      uv: 1,
      windMph: 5
    },
    'neutral'
  );

  assert.ok(
    result.road_conditions.indexOf('Reduced visibility') !== -1
  );
});

test('strong wind affects road advice', function () {
  var result = fallback.fallbackAdvice(
    {
      temperature: { min: 60, max: 65 },
      rain: 'No',
      snow: 'No',
      visibilityMiles: 10,
      uv: 1,
      windMph: 30
    },
    'neutral'
  );

  assert.ok(
    result.road_conditions.indexOf('strong winds') !== -1
  );
});

test('missing weather values do not crash fallback', function () {
  var result = fallback.fallbackAdvice(
    {
      temperature: null,
      rain: 'Not Available',
      snow: 'Not Available',
      visibilityMiles: null,
      uv: null,
      windMph: null
    },
    'neutral'
  );

  assert.strictEqual(
    typeof result.road_conditions,
    'string'
  );

  assert.strictEqual(
    typeof result.dressing,
    'string'
  );

  assert.strictEqual(
    typeof result.accessories,
    'string'
  );
});
