'use strict';

var assert =
  require('assert');

var cap =
  require(
    '../lib/gemini-cap'
  );

var TEST_NOW =
  Date.UTC(
    2026,
    10,
    22,
    12,
    0,
    0
  );

test(
  'Gemini counter uses atomic increment',
  function () {
    var command =
      cap.buildReserveCommand(
        '2026-11-22',
        20,
        TEST_NOW
      );

    assert.ok(
      command
        .UpdateExpression
        .indexOf(
          'if_not_exists(#count, :zero) + :one'
        ) !== -1
    );
  }
);

test(
  'Gemini counter uses conditional cap',
  function () {
    var command =
      cap.buildReserveCommand(
        '2026-11-22',
        20,
        TEST_NOW
      );

    assert.strictEqual(
      command.ConditionExpression,
      'attribute_not_exists(#count) OR #count < :cap'
    );

    assert.strictEqual(
      command
        .ExpressionAttributeValues[
          ':cap'
        ],
      20
    );
  }
);

test(
  'Gemini counter requests updated value',
  function () {
    var command =
      cap.buildReserveCommand(
        '2026-11-22',
        20,
        TEST_NOW
      );

    assert.strictEqual(
      command.ReturnValues,
      'ALL_NEW'
    );
  }
);

test(
  'Gemini counter item receives TTL',
  function () {
    var command =
      cap.buildReserveCommand(
        '2026-11-22',
        20,
        TEST_NOW
      );

    assert.ok(
      command
        .ExpressionAttributeValues[
          ':expiresAt'
        ] >
      Math.floor(
        TEST_NOW / 1000
      )
    );
  }
);

test(
  'Gemini counter key is date scoped',
  function () {
    var command =
      cap.buildReserveCommand(
        '2026-11-22',
        20,
        TEST_NOW
      );

    assert.deepStrictEqual(
      command.Key,
      {
        pk:
          'GEMINI#2026-11-22',

        sk:
          'DAILY'
      }
    );
  }
);
