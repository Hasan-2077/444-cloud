'use strict';

var assert =
  require('assert');

var validation =
  require('../lib/validation');

test(
  'menswear is accepted',
  function () {
    assert.strictEqual(
      validation
        .validateClothingCategory(
          'menswear'
        ).ok,
      true
    );
  }
);

test(
  'womenswear is accepted',
  function () {
    assert.strictEqual(
      validation
        .validateClothingCategory(
          'womenswear'
        ).ok,
      true
    );
  }
);

test(
  'neutral is accepted',
  function () {
    assert.strictEqual(
      validation
        .validateClothingCategory(
          'neutral'
        ).ok,
      true
    );
  }
);

test(
  'free-text clothing category is rejected',
  function () {
    assert.strictEqual(
      validation
        .validateClothingCategory(
          'whatever I want'
        ).ok,
      false
    );
  }
);

test(
  'email is normalized to lowercase',
  function () {
    assert.strictEqual(
      validation.normalizeEmail(
        ' Test@Example.COM '
      ),
      'test@example.com'
    );
  }
);

test(
  'valid email is accepted',
  function () {
    var result =
      validation.validateEmail(
        'Test@Example.com'
      );

    assert.strictEqual(
      result.ok,
      true
    );

    assert.strictEqual(
      result.value,
      'test@example.com'
    );
  }
);

[
  '',
  'not-an-email',
  '@example.com',
  'test@',
  'test example@example.com'
].forEach(
  function (value) {
    test(
      'invalid email rejected: ' +
        JSON.stringify(value),
      function () {
        assert.strictEqual(
          validation
            .validateEmail(
              value
            ).ok,
          false
        );
      }
    );
  }
);

test(
  'valid US ZIP is accepted',
  function () {
    assert.strictEqual(
      validation
        .validateZip(
          '60616'
        ).ok,
      true
    );
  }
);

[
  '',
  '6061',
  '606160',
  'M5V3L9',
  'SW1A1AA',
  'ABCDE'
].forEach(
  function (value) {
    test(
      'invalid Advisor ZIP rejected: ' +
        JSON.stringify(value),
      function () {
        assert.strictEqual(
          validation
            .validateZip(
              value
            ).ok,
          false
        );
      }
    );
  }
);

test(
  'Advisor accepts today',
  function () {
    assert.strictEqual(
      validation.validateDate(
        '2026-11-18',
        '2026-11-18'
      ).ok,
      true
    );
  }
);

test(
  'Advisor accepts today plus six',
  function () {
    assert.strictEqual(
      validation.validateDate(
        '2026-11-24',
        '2026-11-18'
      ).ok,
      true
    );
  }
);

test(
  'Advisor rejects yesterday',
  function () {
    assert.strictEqual(
      validation.validateDate(
        '2026-11-17',
        '2026-11-18'
      ).ok,
      false
    );
  }
);

test(
  'Advisor rejects today plus seven',
  function () {
    assert.strictEqual(
      validation.validateDate(
        '2026-11-25',
        '2026-11-18'
      ).ok,
      false
    );
  }
);

test(
  'Advisor rejects impossible date',
  function () {
    assert.strictEqual(
      validation.validateDate(
        '2026-02-30',
        '2026-02-01'
      ).ok,
      false
    );
  }
);
