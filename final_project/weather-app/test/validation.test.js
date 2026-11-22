'use strict';

var assert = require('assert');

var validation = require('../lib/validation');

test('valid five-digit ZIP is accepted', function () {
  assert.strictEqual(validation.validateZip('60616').ok, true);
});

[
  '',
  '6061',
  '606160',
  'M5V 3L9',
  'SW1A 1AA',
  'ABCDE',
  '12-34',
  '12345678901234567890'
].forEach(function (value) {
  test('invalid ZIP rejected: ' + JSON.stringify(value), function () {
    assert.strictEqual(validation.validateZip(value).ok, false);
  });
});

test('today is accepted', function () {
  assert.strictEqual(
    validation.validateDate('2026-11-17', '2026-11-17').ok,
    true
  );
});

test('today plus 6 days is accepted', function () {
  assert.strictEqual(
    validation.validateDate('2026-11-23', '2026-11-17').ok,
    true
  );
});

test('yesterday is rejected', function () {
  assert.strictEqual(
    validation.validateDate('2026-11-16', '2026-11-17').ok,
    false
  );
});

test('today plus 7 days is rejected', function () {
  assert.strictEqual(
    validation.validateDate('2026-11-24', '2026-11-17').ok,
    false
  );
});

test('impossible calendar date is rejected', function () {
  assert.strictEqual(
    validation.validateDate('2026-02-30', '2026-02-01').ok,
    false
  );
});
test(
  'Chicago local date remains Nov 21 before local midnight',
  function () {
    var now =
      Date.UTC(
        2026,
        10,
        22,
        0,
        15,
        0
      );

    assert.strictEqual(
      validation
        .dateStringInTimeZone(
          'America/Chicago',
          now
        ),
      '2026-11-21'
    );
  }
);

test(
  'New York and Los Angeles dates are calculated independently',
  function () {
    var now =
      Date.UTC(
        2026,
        10,
        22,
        5,
        30,
        0
      );

    assert.strictEqual(
      validation
        .dateStringInTimeZone(
          'America/New_York',
          now
        ),
      '2026-11-22'
    );

    assert.strictEqual(
      validation
        .dateStringInTimeZone(
          'America/Los_Angeles',
          now
        ),
      '2026-11-21'
    );
  }
);

test(
  'timezone-aware validation accepts local today',
  function () {
    var now =
      Date.UTC(
        2026,
        10,
        22,
        0,
        15,
        0
      );

    assert.strictEqual(
      validation
        .validateDateForTimeZone(
          '2026-11-21',
          'America/Chicago',
          now
        ).ok,
      true
    );
  }
);
