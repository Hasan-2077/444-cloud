'use strict';

var assert =
  require('assert');

var emailStatus =
  require(
    '../lib/email-status'
  );

test(
  'sent email returns success status',
  function () {
    var result =
      emailStatus
        .statusForResult({
          state: 'sent'
        });

    assert.strictEqual(
      result.httpStatus,
      200
    );

    assert.strictEqual(
      result.title,
      'Email sent'
    );
  }
);

test(
  'pending consent returns waiting status',
  function () {
    var result =
      emailStatus
        .statusForResult({
          state:
            'pending_confirmation'
        });

    assert.strictEqual(
      result.httpStatus,
      202
    );
  }
);

test(
  'rate limit returns 429',
  function () {
    var result =
      emailStatus
        .statusForResult({
          state:
            'limit_reached'
        });

    assert.strictEqual(
      result.httpStatus,
      429
    );
  }
);

test(
  'disabled email does not claim sent',
  function () {
    var result =
      emailStatus
        .statusForResult({
          state:
            'disabled'
        });

    assert.strictEqual(
      result.httpStatus,
      503
    );

    assert.notStrictEqual(
      result.title,
      'Email sent'
    );
  }
);

test(
  'unknown email failure does not claim sent',
  function () {
    var result =
      emailStatus
        .statusForResult({
          state:
            'failed'
        });

    assert.strictEqual(
      result.httpStatus,
      503
    );

    assert.ok(
      result.message
        .indexOf(
          'not claimed as sent'
        ) !== -1
    );
  }
);
