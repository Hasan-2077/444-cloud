'use strict';

var FACTS_FRESH_SECONDS =
  15 * 60;

var FACTS_STALE_SECONDS =
  6 * 60 * 60;

var FACTS_TTL_SECONDS =
  24 * 60 * 60;

var REPORT_FRESH_SECONDS =
  15 * 60;

var REPORT_TTL_SECONDS =
  60 * 60;

var COUNTER_TTL_SECONDS =
  2 * 24 * 60 * 60;

function nowEpochSeconds(nowMs) {
  return Math.floor(
    (
      typeof nowMs === 'number'
        ? nowMs
        : Date.now()
    ) / 1000
  );
}

function expiresAt(
  seconds,
  nowMs
) {
  return (
    nowEpochSeconds(nowMs) +
    seconds
  );
}

function normalizeCategory(
  category
) {
  return String(category || '')
    .trim()
    .toLowerCase();
}

function factsKey(zip, date) {
  return {
    pk:
      'FACTS#' +
      String(zip),

    sk:
      'DATE#' +
      String(date)
  };
}

function reportKey(
  zip,
  date,
  clothingCategory
) {
  return {
    pk:
      'REPORT#' +
      String(zip) +
      '#' +
      String(date),

    sk:
      'CATEGORY#' +
      normalizeCategory(
        clothingCategory
      )
  };
}

function geminiCounterKey(
  dateString
) {
  return {
    pk:
      'GEMINI#' +
      String(dateString),

    sk:
      'DAILY'
  };
}

function createFactsItem(
  zip,
  date,
  payload,
  nowMs
) {
  var key =
    factsKey(zip, date);

  var created =
    nowEpochSeconds(nowMs);

  return {
    pk: key.pk,
    sk: key.sk,

    itemType:
      'weather_facts',

    zip:
      String(zip),

    date:
      String(date),

    payload:
      payload,

    createdAt:
      created,

    expiresAt:
      created +
      FACTS_TTL_SECONDS
  };
}

function createReportItem(
  zip,
  date,
  clothingCategory,
  report,
  nowMs
) {
  var key =
    reportKey(
      zip,
      date,
      clothingCategory
    );

  var created =
    nowEpochSeconds(nowMs);

  return {
    pk: key.pk,
    sk: key.sk,

    itemType:
      'saved_report',

    zip:
      String(zip),

    date:
      String(date),

    clothingCategory:
      normalizeCategory(
        clothingCategory
      ),

    report:
      report,

    createdAt:
      created,

    expiresAt:
      created +
      REPORT_TTL_SECONDS
  };
}

function createCounterItem(
  dateString,
  count,
  nowMs
) {
  var key =
    geminiCounterKey(
      dateString
    );

  return {
    pk: key.pk,
    sk: key.sk,

    itemType:
      'gemini_daily_counter',

    date:
      String(dateString),

    count:
      Number(count || 0),

    expiresAt:
      expiresAt(
        COUNTER_TTL_SECONDS,
        nowMs
      )
  };
}

function ageSeconds(
  item,
  nowMs
) {
  if (
    !item ||
    typeof item.createdAt !==
      'number'
  ) {
    return null;
  }

  return (
    nowEpochSeconds(nowMs) -
    item.createdAt
  );
}

function isFreshFacts(
  item,
  nowMs
) {
  var age =
    ageSeconds(
      item,
      nowMs
    );

  return (
    age !== null &&
    age >= 0 &&
    age <=
      FACTS_FRESH_SECONDS
  );
}

function isUsableStaleFacts(
  item,
  nowMs
) {
  var age =
    ageSeconds(
      item,
      nowMs
    );

  return (
    age !== null &&
    age >= 0 &&
    age <=
      FACTS_STALE_SECONDS
  );
}

module.exports = {
  FACTS_FRESH_SECONDS:
    FACTS_FRESH_SECONDS,

  FACTS_STALE_SECONDS:
    FACTS_STALE_SECONDS,

  FACTS_TTL_SECONDS:
    FACTS_TTL_SECONDS,

  REPORT_FRESH_SECONDS:
    REPORT_FRESH_SECONDS,

  REPORT_TTL_SECONDS:
    REPORT_TTL_SECONDS,

  COUNTER_TTL_SECONDS:
    COUNTER_TTL_SECONDS,

  nowEpochSeconds:
    nowEpochSeconds,

  expiresAt:
    expiresAt,

  factsKey:
    factsKey,

  reportKey:
    reportKey,

  geminiCounterKey:
    geminiCounterKey,

  createFactsItem:
    createFactsItem,

  createReportItem:
    createReportItem,

  createCounterItem:
    createCounterItem,

  ageSeconds:
    ageSeconds,

  isFreshFacts:
    isFreshFacts,

  isUsableStaleFacts:
    isUsableStaleFacts
};
