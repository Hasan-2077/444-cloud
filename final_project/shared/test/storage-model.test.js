'use strict';

var assert =
  require('assert');

var model =
  require('../lib/storage-model');

var TEST_NOW =
  Date.UTC(
    2026,
    10,
    21,
    12,
    0,
    0
  );

test(
  'facts key uses ZIP and date',
  function () {
    assert.deepStrictEqual(
      model.factsKey(
        '60616',
        '2026-11-21'
      ),
      {
        pk:
          'FACTS#60616',

        sk:
          'DATE#2026-11-21'
      }
    );
  }
);

test(
  'report key includes clothing category',
  function () {
    assert.deepStrictEqual(
      model.reportKey(
        '60616',
        '2026-11-21',
        'Menswear'
      ),
      {
        pk:
          'REPORT#60616#2026-11-21',

        sk:
          'CATEGORY#menswear'
      }
    );
  }
);

test(
  'Gemini counter key is daily',
  function () {
    assert.deepStrictEqual(
      model.geminiCounterKey(
        '2026-11-21'
      ),
      {
        pk:
          'GEMINI#2026-11-21',

        sk:
          'DAILY'
      }
    );
  }
);

test(
  'facts item survives longer than fresh window',
  function () {
    var item =
      model.createFactsItem(
        '60616',
        '2026-11-21',
        { ok: true },
        TEST_NOW
      );

    assert.strictEqual(
      item.expiresAt,
      Math.floor(
        TEST_NOW / 1000
      ) +
      model.FACTS_TTL_SECONDS
    );

    assert.ok(
      model.FACTS_TTL_SECONDS >
      model.FACTS_FRESH_SECONDS
    );
  }
);

test(
  'fresh facts are recognized',
  function () {
    var item =
      model.createFactsItem(
        '60616',
        '2026-11-21',
        {},
        TEST_NOW
      );

    assert.strictEqual(
      model.isFreshFacts(
        item,
        TEST_NOW +
          10 * 60 * 1000
      ),
      true
    );
  }
);

test(
  'facts older than fresh window are not fresh',
  function () {
    var item =
      model.createFactsItem(
        '60616',
        '2026-11-21',
        {},
        TEST_NOW
      );

    assert.strictEqual(
      model.isFreshFacts(
        item,
        TEST_NOW +
          20 * 60 * 1000
      ),
      false
    );
  }
);

test(
  'recent stale facts remain usable during outage',
  function () {
    var item =
      model.createFactsItem(
        '60616',
        '2026-11-21',
        {},
        TEST_NOW
      );

    assert.strictEqual(
      model.isUsableStaleFacts(
        item,
        TEST_NOW +
          2 * 60 * 60 * 1000
      ),
      true
    );
  }
);

test(
  'very old facts are not usable as stale fallback',
  function () {
    var item =
      model.createFactsItem(
        '60616',
        '2026-11-21',
        {},
        TEST_NOW
      );

    assert.strictEqual(
      model.isUsableStaleFacts(
        item,
        TEST_NOW +
          7 * 60 * 60 * 1000
      ),
      false
    );
  }
);

test(
  'saved report receives TTL',
  function () {
    var item =
      model.createReportItem(
        '60616',
        '2026-11-21',
        'neutral',
        { ok: true },
        TEST_NOW
      );

    assert.strictEqual(
      item.expiresAt,
      Math.floor(
        TEST_NOW / 1000
      ) +
      model.REPORT_TTL_SECONDS
    );
  }
);

test(
  'saved report does not contain email address',
  function () {
    var item =
      model.createReportItem(
        '60616',
        '2026-11-21',
        'neutral',
        {
          morning: {},
          night: {}
        },
        TEST_NOW
      );

    assert.strictEqual(
      Object.prototype
        .hasOwnProperty.call(
          item,
          'email'
        ),
      false
    );
  }
);

test(
  'counter receives TTL',
  function () {
    var item =
      model.createCounterItem(
        '2026-11-21',
        3,
        TEST_NOW
      );

    assert.strictEqual(
      item.count,
      3
    );

    assert.strictEqual(
      item.expiresAt,
      Math.floor(
        TEST_NOW / 1000
      ) +
      model.COUNTER_TTL_SECONDS
    );
  }
);
