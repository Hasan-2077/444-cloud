'use strict';

var model =
  require(
    '../../shared/lib/storage-model'
  );

var TABLE =
  process.env.WEATHER_TABLE || '';

var dbRetryAt = 0;

var DB_RETRY_MS =
  Number(
    process.env
      .DYNAMODB_RETRY_MS ||
    30000
  );

var documentClient = null;
var commands = null;

function loadDynamo() {
  if (
    documentClient &&
    commands
  ) {
    return {
      client:
        documentClient,
      commands:
        commands
    };
  }

  /*
   * Lazy-load the AWS SDK.
   *
   * Local tests run without AWS credentials
   * and do not need to parse the SDK.
   */
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
              process.env
                .AWS_REGION,

            maxAttempts: 2
          })
      );

  commands = {
    GetCommand:
      documentSdk.GetCommand,

    PutCommand:
      documentSdk.PutCommand
  };

  return {
    client:
      documentClient,

    commands:
      commands
  };
}

async function withDb(
  stage,
  fn
) {
  if (!TABLE) {
    return {
      state: 'disabled'
    };
  }

  if (
    Date.now() <
    dbRetryAt
  ) {
    return {
      state: 'unavailable'
    };
  }

  try {
    return {
      state: 'ok',
      value:
        await fn()
    };
  } catch (err) {
    dbRetryAt =
      Date.now() +
      DB_RETRY_MS;

    console.log(
      JSON.stringify({
        ts:
          new Date()
            .toISOString(),

        event:
          'cache_error',

        stage:
          stage,

        name:
          err.name,

        message:
          err.message
      })
    );

    return {
      state: 'unavailable'
    };
  }
}

async function readItem(
  zip,
  date
) {
  return withDb(
    'facts_read',
    async function () {
      var dynamo =
        loadDynamo();

      var key =
        model.factsKey(
          zip,
          date
        );

      var result =
        await dynamo.client.send(
          new dynamo
            .commands
            .GetCommand({
              TableName:
                TABLE,

              Key: key
            })
        );

      return (
        result.Item ||
        null
      );
    }
  );
}

async function findFresh(
  zip,
  date,
  nowMs
) {
  var result =
    await readItem(
      zip,
      date
    );

  if (
    result.state !==
    'ok'
  ) {
    return result;
  }

  if (
    !result.value ||
    !model.isFreshFacts(
      result.value,
      nowMs
    )
  ) {
    return {
      state: 'ok',
      value: null
    };
  }

  return {
    state: 'ok',

    value:
      result.value.payload,

    ageSeconds:
      model.ageSeconds(
        result.value,
        nowMs
      )
  };
}

async function findStale(
  zip,
  date,
  nowMs
) {
  var result =
    await readItem(
      zip,
      date
    );

  if (
    result.state !==
    'ok'
  ) {
    return result;
  }

  if (
    !result.value ||
    !model
      .isUsableStaleFacts(
        result.value,
        nowMs
      )
  ) {
    return {
      state: 'ok',
      value: null
    };
  }

  return {
    state: 'ok',

    value:
      result.value.payload,

    ageSeconds:
      model.ageSeconds(
        result.value,
        nowMs
      )
  };
}

async function saveFacts(
  zip,
  date,
  payload,
  nowMs
) {
  return withDb(
    'facts_write',
    async function () {
      var dynamo =
        loadDynamo();

      var item =
        model.createFactsItem(
          zip,
          date,
          payload,
          nowMs
        );

      await dynamo.client.send(
        new dynamo
          .commands
          .PutCommand({
            TableName:
              TABLE,

            Item:
              item
          })
      );

      return item;
    }
  );
}

module.exports = {
  findFresh:
    findFresh,

  findStale:
    findStale,

  saveFacts:
    saveFacts
};
