'use strict';

var model =
  require(
    '../../shared/lib/storage-model'
  );

var TABLE =
  process.env.REPORT_TABLE || '';

var DAILY_CAP =
  Number(
    process.env.GEMINI_DAILY_CAP ||
    20
  );

var documentClient = null;
var UpdateCommand = null;

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

            maxAttempts: 2
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
  dateString,
  cap,
  nowMs
) {
  var key =
    model.geminiCounterKey(
      dateString
    );

  var counter =
    model.createCounterItem(
      dateString,
      0,
      nowMs
    );

  return {
    TableName:
      TABLE,

    Key:
      key,

    UpdateExpression:
      [
        'SET',
        '#itemType = if_not_exists(#itemType, :itemType),',
        '#date = if_not_exists(#date, :date),',
        '#expiresAt = if_not_exists(#expiresAt, :expiresAt),',
        '#count = if_not_exists(#count, :zero) + :one'
      ].join(' '),

    ConditionExpression:
      'attribute_not_exists(#count) OR #count < :cap',

    ExpressionAttributeNames: {
      '#itemType':
        'itemType',

      '#date':
        'date',

      '#expiresAt':
        'expiresAt',

      '#count':
        'count'
    },

    ExpressionAttributeValues: {
      ':itemType':
        'gemini_daily_counter',

      ':date':
        String(dateString),

      ':expiresAt':
        counter.expiresAt,

      ':zero':
        0,

      ':one':
        1,

      ':cap':
        Number(cap)
    },

    ReturnValues:
      'ALL_NEW'
  };
}

async function reserveGeminiCall(
  dateString,
  nowMs
) {
  if (!TABLE) {
    return {
      state:
        'disabled',

      allowed:
        true,

      count:
        null,

      cap:
        DAILY_CAP
    };
  }

  var dynamo =
    loadDynamo();

  var commandInput =
    buildReserveCommand(
      dateString,
      DAILY_CAP,
      nowMs
    );

  try {
    var result =
      await dynamo.client.send(
        new dynamo
          .UpdateCommand(
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

      cap:
        DAILY_CAP
    };
  } catch (err) {
    if (
      err.name ===
      'ConditionalCheckFailedException'
    ) {
      return {
        state:
          'cap_reached',

        allowed:
          false,

        count:
          DAILY_CAP,

        cap:
          DAILY_CAP
      };
    }

    console.log(
      JSON.stringify({
        ts:
          new Date()
            .toISOString(),

        event:
          'gemini_cap_error',

        name:
          err.name,

        message:
          err.message
      })
    );

    /*
     * Fail closed for AI use.
     *
     * If the counter cannot be checked,
     * do not risk exceeding the quota.
     */
    return {
      state:
        'unavailable',

      allowed:
        false,

      count:
        null,

      cap:
        DAILY_CAP
    };
  }
}

module.exports = {
  DAILY_CAP:
    DAILY_CAP,

  buildReserveCommand:
    buildReserveCommand,

  reserveGeminiCall:
    reserveGeminiCall
};
