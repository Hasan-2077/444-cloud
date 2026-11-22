'use strict';

var assert = require('assert');

var precipitation = require('../lib/precipitation');

test('rain 0 mm and probability below 20 is No', function () {
  assert.strictEqual(
    precipitation.classifyRain(0, 19),
    'No'
  );
});

test('rain 0 mm and probability 20 is Mild', function () {
  assert.strictEqual(
    precipitation.classifyRain(0, 20),
    'Mild'
  );
});

test('rain just above zero is Mild', function () {
  assert.strictEqual(
    precipitation.classifyRain(0.01, 0),
    'Mild'
  );
});

test('rain just below 7.6 is Mild', function () {
  assert.strictEqual(
    precipitation.classifyRain(7.59, 0),
    'Mild'
  );
});

test('rain exactly 7.6 is Mild', function () {
  assert.strictEqual(
    precipitation.classifyRain(7.6, 0),
    'Mild'
  );
});

test('rain just above 7.6 is Heavy', function () {
  assert.strictEqual(
    precipitation.classifyRain(7.61, 0),
    'Heavy'
  );
});

test('missing rain amount with probability below 20 is No', function () {
  assert.strictEqual(
    precipitation.classifyRain(null, 19),
    'No'
  );
});

test('missing rain amount with probability 20 is Mild', function () {
  assert.strictEqual(
    precipitation.classifyRain(null, 20),
    'Mild'
  );
});

test('missing rain amount and probability is Not Available', function () {
  assert.strictEqual(
    precipitation.classifyRain(null, null),
    'Not Available'
  );
});

test('snow 0 cm is No', function () {
  assert.strictEqual(
    precipitation.classifySnow(0),
    'No'
  );
});

test('snow just above zero is Mild', function () {
  assert.strictEqual(
    precipitation.classifySnow(0.01),
    'Mild'
  );
});

test('snow just below 10 cm is Mild', function () {
  assert.strictEqual(
    precipitation.classifySnow(9.99),
    'Mild'
  );
});

test('snow exactly 10 cm is Heavy', function () {
  assert.strictEqual(
    precipitation.classifySnow(10),
    'Heavy'
  );
});

test('snow above 10 cm is Heavy', function () {
  assert.strictEqual(
    precipitation.classifySnow(10.01),
    'Heavy'
  );
});

test('missing snow is Not Available', function () {
  assert.strictEqual(
    precipitation.classifySnow(null),
    'Not Available'
  );
});
