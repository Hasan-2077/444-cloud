'use strict';

var model =
  require(
    '../../shared/lib/storage-model'
  );

var TABLE =
  process.env.REPORT_TABLE || '';

var dbRetryAt = 0;

var DB_RETRY_MS =
  Number(
    process.env.DYNAMODB_RETRY_MS ||
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
      client: documentClient,
      commands: commands
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

  commands = {
    GetCommand:
      documentSdk.GetCommand,

    PutCommand:
      documentSdk.PutCommand
  };

  return {
    client: documentClient,
    commands: commands
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
          'report_cache_error',

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

async function findFreshReport(
  zip,
  date,
  clothingCategory,
  nowMs
) {
  return withDb(
    'report_read',
    async function () {
      var dynamo =
        loadDynamo();

      var key =
        model.reportKey(
          zip,
          date,
          clothingCategory
        );

      var result =
        await dynamo.client.send(
          new dynamo
            .commands
            .GetCommand({
              TableName:
                TABLE,

              Key:
                key
            })
        );

      var item =
        result.Item ||
        null;

      if (!item) {
        return null;
      }

      var age =
        model.ageSeconds(
          item,
          nowMs
        );

      if (
        age === null ||
        age < 0 ||
        age >
          model.REPORT_FRESH_SECONDS
      ) {
        return null;
      }

      return {
        report:
          item.report,

        ageSeconds:
          age
      };
    }
  );
}

async function saveReport(
  zip,
  date,
  clothingCategory,
  report,
  nowMs
) {
  return withDb(
    'report_write',
    async function () {
      var dynamo =
        loadDynamo();

      var item =
        model.createReportItem(
          zip,
          date,
          clothingCategory,
          report,
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
  findFreshReport:
    findFreshReport,

  saveReport:
    saveReport
};
