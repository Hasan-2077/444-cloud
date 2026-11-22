'use strict';

var assert = require('assert');
var units = require('../lib/units');

test('1609.344 meters equals one mile', function () {
  assert.ok(
    Math.abs(units.metersToMiles(1609.344) - 1) < 0.000001
  );
});

test('zero meters equals zero miles', function () {
  assert.strictEqual(
    units.metersToMiles(0),
    0
  );
});

test('invalid visibility returns null', function () {
  assert.strictEqual(
    units.metersToMiles(null),
    null
  );

  assert.strictEqual(
    units.metersToMiles('bad'),
    null
  );
});
