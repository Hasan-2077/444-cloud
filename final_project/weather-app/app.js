'use strict';

var express =
  require('express');

var validation =
  require('./lib/validation');

var weatherService =
  require(
    './lib/weather-service'
  );

var weatherCache =
  require(
    './lib/weather-cache'
  );

var app =
  express();

var PORT =
  Number(
    process.env.PORT ||
    3000
  );

function log(
  event,
  fields
) {
  var record = {
    ts:
      new Date()
        .toISOString(),

    event:
      event
  };

  Object.keys(
    fields || {}
  ).forEach(
    function (key) {
      record[key] =
        fields[key];
    }
  );

  console.log(
    JSON.stringify(
      record
    )
  );
}

function currentDateString() {
  return new Date()
    .toISOString()
    .slice(0, 10);
}

function withCacheMetadata(
  report,
  cache,
  ageSeconds
) {
  var result =
    Object.assign(
      {},
      report,
      {
        cache:
          cache
      }
    );

  if (
    typeof ageSeconds ===
    'number'
  ) {
    result.cacheAgeSeconds =
      ageSeconds;
  }

  return result;
}

app.get(
  '/',
  function (req, res) {
    res.json({
      service:
        'weather-data',

      status:
        'ok',

      usage:
        '/weather?zip=60616&date=YYYY-MM-DD'
    });
  }
);

app.get(
  '/weather',
  async function (req, res) {
    var started =
      Date.now();

    var zip =
      String(
        req.query.zip ||
        ''
      );

    var date =
      String(
        req.query.date ||
        ''
      );

    var zipResult =
      validation
        .validateZip(
          zip
        );

    if (!zipResult.ok) {
      log(
        'weather_rejected',
        {
          reason:
            'invalid_zip'
        }
      );

      return res
        .status(400)
        .json({
          error:
            'invalid_zip',

          message:
            'This service supports five-digit US ZIP codes only.'
        });
    }

    var dateResult =
      validation
        .validateDate(
          date,
          currentDateString()
        );

    if (!dateResult.ok) {
      log(
        'weather_rejected',
        {
          reason:
            'invalid_date'
        }
      );

      return res
        .status(400)
        .json({
          error:
            'invalid_date',

          message:
            dateResult.error
        });
    }

    log(
      'weather_request',
      {
        zip:
          zip,

        date:
          date
      }
    );

    /*
     * First choice:
     * fresh DynamoDB cache.
     */
    var cached =
      await weatherCache
        .findFresh(
          zip,
          date
        );

    if (
      cached.state ===
        'ok' &&
      cached.value
    ) {
      log(
        'weather_success',
        {
          zip:
            zip,

          date:
            date,

          cache:
            'hit',

          ageSeconds:
            cached
              .ageSeconds,

          ms:
            Date.now() -
            started
        }
      );

      return res.json(
        withCacheMetadata(
          cached.value,
          'hit',
          cached.ageSeconds
        )
      );
    }

    try {
      /*
       * No fresh cache.
       * Call the real sources.
       */
      var report =
        await weatherService
          .getWeatherReport(
            zip,
            date
          );

      var saved =
        await weatherCache
          .saveFacts(
            zip,
            date,
            report
          );

      var cacheState =
        saved.state === 'ok'
          ? 'miss'
          : saved.state;

      log(
        'weather_success',
        {
          zip:
            zip,

          date:
            date,

          cache:
            cacheState,

          ms:
            Date.now() -
            started
        }
      );

      return res.json(
        withCacheMetadata(
          report,
          cacheState
        )
      );
    } catch (err) {
      /*
       * Weather source failure:
       * try a recent stale copy.
       */
      if (err.stage) {
        var stale =
          await weatherCache
            .findStale(
              zip,
              date
            );

        if (
          stale.state ===
            'ok' &&
          stale.value
        ) {
          log(
            'weather_success',
            {
              zip:
                zip,

              date:
                date,

              cache:
                'stale',

              ageSeconds:
                stale
                  .ageSeconds,

              failedStage:
                err.stage,

              ms:
                Date.now() -
                started
            }
          );

          return res.json(
            withCacheMetadata(
              stale.value,
              'stale',
              stale.ageSeconds
            )
          );
        }
      }

      if (
        err.code ===
          'zip_not_found' ||
        err.code ===
          'no_nws_coverage'
      ) {
        log(
          'weather_rejected',
          {
            reason:
              err.code,

            zip:
              zip
          }
        );

        return res
          .status(
            err.status ||
            404
          )
          .json({
            error:
              err.code,

            message:
              err.message
          });
      }

      if (err.stage) {
        log(
          'weather_error',
          {
            zip:
              zip,

            date:
              date,

            stage:
              err.stage
          }
        );

        return res
          .status(502)
          .json({
            error:
              'weather_data_unavailable',

            stage:
              err.stage,

            message:
              'Weather data is temporarily unavailable.'
          });
      }

      log(
        'weather_error',
        {
          zip:
            zip,

          date:
            date,

          stage:
            'internal',

          message:
            err.message
        }
      );

      return res
        .status(500)
        .json({
          error:
            'internal_error'
        });
    }
  }
);

app.listen(
  PORT,
  function () {
    log(
      'weather_started',
      {
        port:
          PORT,

        table:
          process.env
            .WEATHER_TABLE ||
          null
      }
    );
  }
);
