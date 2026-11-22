'use strict';

var crypto =
  require('crypto');

var TABLE =
  process.env.REPORT_TABLE || '';

var WINDOW_SECONDS =
  Number(
    process.env.EMAIL_LIMIT_WINDOW_SECONDS ||
    3600
  );

var WINDOW_MS =
  WINDOW_SECONDS * 1000;

var MAX_REQUESTS =
  Number(
    process.env.EMAIL_LIMIT ||
    3
  );

var buckets = {};

var documentClient = null;
var UpdateCommand = null;


function normalizeVisitorKey(value) {
  return String(value || '')
    .trim()
    .toLowerCase();
}


function hashVisitorKey(value) {
  var normalized =
    normalizeVisitorKey(
      value
    );

  if (!normalized) {
    normalized = 'unknown';
  }

  return crypto
    .createHash('sha256')
    .update(normalized)
    .digest('hex');
}


function cleanup(nowMs) {
  Object.keys(
    buckets
  ).forEach(
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
      startedAt: now,
      count: 0
    };
  }

  if (
    buckets[key].count >=
    MAX_REQUESTS
  ) {
    return {
      state:
        'limit_reached',

      allowed:
        false,

      count:
        buckets[key].count,

      max:
        MAX_REQUESTS,

      limit:
        MAX_REQUESTS
    };
  }

  buckets[key].count += 1;

  return {
    state:
      'ok',

    allowed:
      true,

    count:
      buckets[key].count,

    max:
      MAX_REQUESTS,

    limit:
      MAX_REQUESTS
  };
}


function loadDynamo() {
  if (
    documentClient &&
    UpdateCommand
  ) {
    return {
      client:
        documentClient,

      UpdateCommand:
        UpdateCommand
    };
  }

  var clientSdk =
    require(
      '@aws-sdk/client-dynamodb'
    );

  var documentSdk =
    require(
      '@aws-sdk/lib-dynamodb'
    );

  documentClient =
    documentSdk
      .DynamoDBDocumentClient
      .from(
        new clientSdk
          .DynamoDBClient({
            region:
              process.env.AWS_REGION,

            maxAttempts:
              2
          })
      );

  UpdateCommand =
    documentSdk.UpdateCommand;

  return {
    client:
      documentClient,

    UpdateCommand:
      UpdateCommand
  };
}


function buildReserveCommand(
  visitorKey,
  nowMs
) {
  var now =
    typeof nowMs === 'number'
      ? nowMs
      : Date.now();

  var epochSeconds =
    Math.floor(
      now / 1000
    );

  var windowStart =
    Math.floor(
      epochSeconds /
      WINDOW_SECONDS
    ) *
    WINDOW_SECONDS;

  var expiresAt =
    windowStart +
    WINDOW_SECONDS +
    3600;

  var visitorHash =
    hashVisitorKey(
      visitorKey
    );

  return {
    TableName:
      TABLE,

    Key: {
      pk:
        'EMAIL#' +
        visitorHash,

      sk:
        'WINDOW#' +
        String(
          windowStart
        )
    },

    UpdateExpression:
      [
        'SET',
        '#itemType = if_not_exists(#itemType, :itemType),',
        '#windowStart = if_not_exists(#windowStart, :windowStart),',
        '#expiresAt = if_not_exists(#expiresAt, :expiresAt),',
        '#count = if_not_exists(#count, :zero) + :one'
      ].join(' '),

    ConditionExpression:
      'attribute_not_exists(#count) OR #count < :limit',

    ExpressionAttributeNames: {
      '#itemType':
        'itemType',

      '#windowStart':
        'windowStart',

      '#expiresAt':
        'expiresAt',

      '#count':
        'count'
    },

    ExpressionAttributeValues: {
      ':itemType':
        'email_rate_limit',

      ':windowStart':
        windowStart,

      ':expiresAt':
        expiresAt,

      ':zero':
        0,

      ':one':
        1,

      ':limit':
        MAX_REQUESTS
    },

    ReturnValues:
      'ALL_NEW'
  };
}


async function reserveEmail(
  visitorKey,
  nowMs
) {
  /*
   * Local/test mode:
   * if DynamoDB is not configured,
   * use the in-memory limiter.
   */
  if (!TABLE) {
    var local =
      checkAndConsume(
        visitorKey,
        nowMs
      );

    return {
      state:
        local.state,

      allowed:
        local.allowed,

      count:
        local.count,

      limit:
        MAX_REQUESTS
    };
  }

  var dynamo =
    loadDynamo();

  var commandInput =
    buildReserveCommand(
      visitorKey,
      nowMs
    );

  try {
    var result =
      await dynamo.client.send(
        new dynamo.UpdateCommand(
          commandInput
        )
      );

    return {
      state:
        'ok',

      allowed:
        true,

      count:
        result.Attributes
          ? result.Attributes.count
          : null,

      limit:
        MAX_REQUESTS
    };
  } catch (err) {
    if (
      err.name ===
      'ConditionalCheckFailedException'
    ) {
      return {
        state:
          'limit_reached',

        allowed:
          false,

        count:
          MAX_REQUESTS,

        limit:
          MAX_REQUESTS
      };
    }

    console.log(
      JSON.stringify({
        ts:
          new Date()
            .toISOString(),

        event:
          'email_limit_error',

        name:
          err.name,

        message:
          err.message
      })
    );

    /*
     * Fail closed:
     * if the abuse-control counter
     * cannot be checked, do not send.
     */
    return {
      state:
        'unavailable',

      allowed:
        false,

      count:
        null,

      limit:
        MAX_REQUESTS
    };
  }
}


function resetForTests() {
  buckets = {};
}


module.exports = {
  WINDOW_MS:
    WINDOW_MS,

  WINDOW_SECONDS:
    WINDOW_SECONDS,

  MAX_REQUESTS:
    MAX_REQUESTS,

  normalizeVisitorKey:
    normalizeVisitorKey,

  hashVisitorKey:
    hashVisitorKey,

  checkAndConsume:
    checkAndConsume,

  buildReserveCommand:
    buildReserveCommand,

  reserveEmail:
    reserveEmail,

  resetForTests:
    resetForTests
};
