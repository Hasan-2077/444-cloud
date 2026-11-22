'use strict';

var assert = require('assert');
var aggregation = require('../lib/aggregation');

test('minMax returns correct minimum and maximum', function () {
  assert.deepStrictEqual(
    aggregation.minMax([40, 52, 48, 61]),
    { min: 40, max: 61 }
  );
});

test('minMax ignores non-numeric values', function () {
  assert.deepStrictEqual(
    aggregation.minMax([40, null, 'bad', 60]),
    { min: 40, max: 60 }
  );
});

test('minMax returns null when no numbers exist', function () {
  assert.strictEqual(
    aggregation.minMax([null, undefined, 'bad']),
    null
  );
});

test('maximum returns the highest numeric value', function () {
  assert.strictEqual(
    aggregation.maximum([4, 9, 2]),
    9
  );
});

test('minimum returns the lowest numeric value', function () {
  assert.strictEqual(
    aggregation.minimum([4, 9, 2]),
    2
  );
});

test('average returns arithmetic mean', function () {
  assert.strictEqual(
    aggregation.average([40, 50, 60]),
    50
  );
});

test('sum returns total', function () {
  assert.strictEqual(
    aggregation.sum([1, 2, 3, 4]),
    10
  );
});

test('aggregation functions return null for missing numeric data', function () {
  assert.strictEqual(aggregation.maximum([]), null);
  assert.strictEqual(aggregation.minimum([]), null);
  assert.strictEqual(aggregation.average([]), null);
  assert.strictEqual(aggregation.sum([]), null);
});
