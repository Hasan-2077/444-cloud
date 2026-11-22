'use strict';

var assert =
  require('assert');

var limit =
  require(
    '../lib/email-limit'
  );

test(
  'first email request is allowed',
  function () {
    limit.resetForTests();

    var result =
      limit.checkAndConsume(
        'visitor-a',
        1000
      );

    assert.strictEqual(
      result.allowed,
      true
    );

    assert.strictEqual(
      result.count,
      1
    );
  }
);

test(
  'email limit blocks after maximum',
  function () {
    limit.resetForTests();

    var i;

    for (
      i = 0;
      i < limit.MAX_REQUESTS;
      i += 1
    ) {
      assert.strictEqual(
        limit.checkAndConsume(
          'visitor-a',
          1000 + i
        ).allowed,
        true
      );
    }

    assert.strictEqual(
      limit.checkAndConsume(
        'visitor-a',
        2000
      ).allowed,
      false
    );
  }
);

test(
  'different visitors have separate limits',
  function () {
    limit.resetForTests();

    var i;

    for (
      i = 0;
      i < limit.MAX_REQUESTS;
      i += 1
    ) {
      limit.checkAndConsume(
        'visitor-a',
        1000 + i
      );
    }

    assert.strictEqual(
      limit.checkAndConsume(
        'visitor-b',
        2000
      ).allowed,
      true
    );
  }
);

test(
  'email limit resets after window',
  function () {
    limit.resetForTests();

    var i;

    for (
      i = 0;
      i < limit.MAX_REQUESTS;
      i += 1
    ) {
      limit.checkAndConsume(
        'visitor-a',
        1000 + i
      );
    }

    var later =
      1000 +
      limit.WINDOW_MS +
      1000;

    assert.strictEqual(
      limit.checkAndConsume(
        'visitor-a',
        later
      ).allowed,
      true
    );
  }
);
