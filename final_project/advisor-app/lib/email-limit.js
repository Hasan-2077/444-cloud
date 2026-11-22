'use strict';

var WINDOW_MS =
  Number(
    process.env.EMAIL_LIMIT_WINDOW_SECONDS ||
    3600
  ) * 1000;

var MAX_REQUESTS =
  Number(
    process.env.EMAIL_LIMIT_MAX ||
    5
  );

var buckets = {};

function normalizeVisitorKey(value) {
  return String(value || '')
    .trim()
    .toLowerCase();
}

function cleanup(nowMs) {
  Object.keys(buckets)
    .forEach(
      function (key) {
        if (
          nowMs -
          buckets[key].startedAt >
          WINDOW_MS
        ) {
          delete buckets[key];
        }
      }
    );
}

function checkAndConsume(
  visitorKey,
  nowMs
) {
  var now =
    typeof nowMs === 'number'
      ? nowMs
      : Date.now();

  cleanup(now);

  var key =
    normalizeVisitorKey(
      visitorKey
    );

  if (!key) {
    key = 'unknown';
  }

  if (!buckets[key]) {
    buckets[key] = {
      startedAt:
        now,

      count:
        0
    };
  }

  if (
    buckets[key].count >=
    MAX_REQUESTS
  ) {
    return {
      allowed:
        false,

      count:
        buckets[key].count,

      max:
        MAX_REQUESTS
    };
  }

  buckets[key].count += 1;

  return {
    allowed:
      true,

    count:
      buckets[key].count,

    max:
      MAX_REQUESTS
  };
}

function resetForTests() {
  buckets = {};
}

module.exports = {
  WINDOW_MS:
    WINDOW_MS,

  MAX_REQUESTS:
    MAX_REQUESTS,

  checkAndConsume:
    checkAndConsume,

  resetForTests:
    resetForTests
};
