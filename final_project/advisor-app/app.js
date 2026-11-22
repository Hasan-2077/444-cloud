'use strict';

var express = require('express');

var validation = require('./lib/validation');
var weatherClient = require('./lib/weather-client');
var prompt = require('./lib/prompt');
var geminiClient = require('./lib/gemini-client');
var geminiValidation = require('./lib/gemini');
var fallback = require('./lib/fallback');
var escape = require('./lib/escape');

var reportCache =
  require('./lib/report-cache');

var geminiCap =
  require('./lib/gemini-cap');

var emailService =
  require('./lib/email');

var emailLimit =
  require('./lib/email-limit');

var emailStatus =
  require('./lib/email-status');

var app = express();

var PORT =
  Number(
    process.env.PORT ||
    3001
  );

/*
 * Behind the ALB this allows req.ip
 * to use the forwarded visitor address.
 */
app.set(
  'trust proxy',
  1
);

app.use(
  express.urlencoded({
    extended: false
  })
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

function formatNumber(
  value,
  digits
) {
  if (
    typeof value !== 'number' ||
    !isFinite(value)
  ) {
    return 'Not Available';
  }

  return value.toFixed(
    digits
  );
}

function displayTemperature(
  period
) {
  if (
    !period ||
    !period.temperature
  ) {
    return 'Not Available';
  }

  return (
    period.temperature.min +
    '–' +
    period.temperature.max +
    ' °' +
    period.temperature.unit
  );
}

function displayWind(
  period
) {
  if (
    !period ||
    !period.wind ||
    typeof period.wind
      .maxMph !== 'number'
  ) {
    return 'Not Available';
  }

  return (
    period.wind.maxMph +
    ' mph'
  );
}

function displayVisibility(
  period
) {
  if (
    !period ||
    !period.visibility ||
    typeof period.visibility
      .minMiles !== 'number'
  ) {
    return 'Not Available';
  }

  return (
    formatNumber(
      period.visibility
        .minMiles,
      1
    ) +
    ' miles'
  );
}

function displayUv(
  period
) {
  if (
    !period ||
    !period.uv ||
    typeof period.uv
      .maxIndex !== 'number'
  ) {
    return 'Not Available';
  }

  return String(
    period.uv.maxIndex
  );
}

function displayHumidity(
  period
) {
  if (
    !period ||
    !period.humidity ||
    typeof period.humidity
      .averagePercent !==
      'number'
  ) {
    return 'Not Available';
  }

  return (
    formatNumber(
      period.humidity
        .averagePercent,
      1
    ) +
    '%'
  );
}

function periodFallback(
  period,
  clothingCategory
) {
  return fallback
    .fallbackAdvice(
      {
        temperature:
          period.temperature,

        rain:
          period.rain
            ? period.rain
                .category
            : 'Not Available',

        snow:
          period.snow
            ? period.snow
                .category
            : 'Not Available',

        visibilityMiles:
          period.visibility
            ? period.visibility
                .minMiles
            : null,

        uv:
          period.uv
            ? period.uv
                .maxIndex
            : null,

        windMph:
          period.wind
            ? period.wind
                .maxMph
            : null
      },

      clothingCategory
    );
}

function buildFallbackAdvice(
  weather,
  clothingCategory
) {
  return {
    morning:
      periodFallback(
        weather.morning,
        clothingCategory
      ),

    night:
      periodFallback(
        weather.night,
        clothingCategory
      )
  };
}

async function getAdvice(
  weather,
  clothingCategory
) {
  var reservation =
    await geminiCap
      .reserveGeminiCall(
        weather.date
      );

  if (!reservation.allowed) {
    log(
      'gemini_cap_reached',
      {
        date:
          weather.date,

        state:
          reservation.state,

        cap:
          reservation.cap
      }
    );

    return {
      source:
        'fallback',

      model:
        null,

      reason:
        reservation.state,

      advice:
        buildFallbackAdvice(
          weather,
          clothingCategory
        )
    };
  }

  if (
    reservation.state ===
    'ok'
  ) {
    log(
      'gemini_call_reserved',
      {
        date:
          weather.date,

        count:
          reservation.count,

        cap:
          reservation.cap
      }
    );
  }

  var advicePrompt =
    prompt.buildAdvicePrompt(
      weather,
      clothingCategory
    );

  try {
    var generated =
      await geminiClient
        .generateAdvice(
          advicePrompt
        );

    var checked =
      geminiValidation
        .validateGeminiAdvice(
          generated.advice
        );

    if (!checked.ok) {
      throw new Error(
        checked.error
      );
    }

    return {
      source:
        'gemini',

      model:
        generated.model,

      advice:
        checked.value
    };
  } catch (err) {
    log(
      'gemini_error',
      {
        message:
          err.message,

        status:
          err.status ||
          null
      }
    );

    return {
      source:
        'fallback',

      model:
        null,

      reason:
        'gemini_failure',

      advice:
        buildFallbackAdvice(
          weather,
          clothingCategory
        )
    };
  }
}

function renderForm(
  errorMessage
) {
  var errorHtml =
    errorMessage
      ? (
          '<div class="error">' +
          escape.escapeHtml(
            errorMessage
          ) +
          '</div>'
        )
      : '';

  return (
    '<!doctype html>' +
    '<html lang="en">' +

    '<head>' +
    '<meta charset="utf-8">' +

    '<meta name="viewport" content="width=device-width, initial-scale=1">' +

    '<title>Weather Advisor</title>' +

    '<style>' +

    'body{font-family:Arial,sans-serif;max-width:900px;margin:40px auto;padding:0 20px;line-height:1.5}' +

    'form{display:grid;gap:14px;max-width:520px}' +

    'label{font-weight:700}' +

    'input,select,button{font:inherit;padding:10px}' +

    'button{cursor:pointer}' +

    '.error{padding:12px;margin-bottom:18px;border:1px solid #b00020}' +

    '</style>' +

    '</head>' +

    '<body>' +

    '<h1>Weather Advisor</h1>' +

    '<p>Generate a Morning and Night weather report for a US ZIP code.</p>' +

    '<p>The weather facts and clothing category may be sent to Google Gemini for advice. Your email address is never sent to Gemini.</p>' +

    errorHtml +

    '<form method="post" action="/report">' +

    '<label for="date">Date</label>' +

    '<input id="date" name="date" type="date" required>' +

    '<label for="zip">US ZIP code</label>' +

    '<input id="zip" name="zip" type="text" inputmode="numeric" maxlength="5" required>' +

    '<label for="clothingCategory">Clothing category</label>' +

    '<select id="clothingCategory" name="clothingCategory" required>' +

    '<option value="neutral">Neutral</option>' +

    '<option value="menswear">Menswear</option>' +

    '<option value="womenswear">Womenswear</option>' +

    '</select>' +

    '<label for="email">Email address</label>' +

    '<input id="email" name="email" type="email" required>' +

    '<button type="submit">Generate Report</button>' +

    '</form>' +

    '</body>' +
    '</html>'
  );
}

function renderPeriodTable(
  title,
  period,
  advice,
  adviceSource
) {
  var adviceLabel =
    adviceSource ===
      'gemini'
      ? 'Gemini'
      : 'Rule-based fallback';

  var rows = [
    [
      'Temperature',
      displayTemperature(
        period
      ),

      period.temperature
        ? period.temperature
            .source
        : 'N/A'
    ],

    [
      'Wind speed',
      displayWind(
        period
      ),

      period.wind
        ? period.wind.source
        : 'N/A'
    ],

    [
      'Visibility',
      displayVisibility(
        period
      ),

      period.visibility
        ? period.visibility
            .source
        : 'N/A'
    ],

    [
      'UV',
      displayUv(
        period
      ),

      period.uv
        ? period.uv.source
        : 'N/A'
    ],

    [
      'Humidity',
      displayHumidity(
        period
      ),

      period.humidity
        ? period.humidity
            .source
        : 'N/A'
    ],

    [
      'Rain',
      period.rain
        ? period.rain
            .category
        : 'Not Available',

      period.rain
        ? period.rain.source
        : 'N/A'
    ],

    [
      'Snow',
      period.snow
        ? period.snow
            .category
        : 'Not Available',

      period.snow
        ? period.snow.source
        : 'N/A'
    ],

    [
      'Suggested road conditions',
      advice.road_conditions,
      adviceLabel
    ],

    [
      'Suggested dressing',
      advice.dressing,
      adviceLabel
    ],

    [
      'Suggested accessories',
      advice.accessories,
      adviceLabel
    ]
  ];

  var body =
    rows.map(
      function (row) {
        return (
          '<tr>' +

          '<th>' +
          escape.escapeHtml(
            row[0]
          ) +
          '</th>' +

          '<td>' +
          escape.escapeHtml(
            row[1]
          ) +
          '</td>' +

          '<td class="source">' +
          escape.escapeHtml(
            row[2]
          ) +
          '</td>' +

          '</tr>'
        );
      }
    ).join('');

  return (
    '<section>' +

    '<h2>' +
    escape.escapeHtml(
      title
    ) +
    '</h2>' +

    '<table>' +

    '<thead>' +

    '<tr>' +
    '<th>Item</th>' +
    '<th>Result</th>' +
    '<th>Source</th>' +
    '</tr>' +

    '</thead>' +

    '<tbody>' +
    body +
    '</tbody>' +

    '</table>' +
    '</section>'
  );
}

function renderReport(
  weather,
  adviceResult,
  email,
  clothingCategory,
  cacheInfo
) {
  var cacheNotice = '';

  if (
    cacheInfo &&
    cacheInfo.hit
  ) {
    cacheNotice =
      '<div class="notice">' +

      'This report was returned from the saved-report cache. Cache age: ' +

      escape.escapeHtml(
        String(
          cacheInfo
            .ageSeconds
        )
      ) +

      ' seconds.' +

      '</div>';
  }

  return (
    '<!doctype html>' +
    '<html lang="en">' +

    '<head>' +

    '<meta charset="utf-8">' +

    '<meta name="viewport" content="width=device-width, initial-scale=1">' +

    '<title>Weather Advisor Report</title>' +

    '<style>' +

    'body{font-family:Arial,sans-serif;max-width:1200px;margin:30px auto;padding:0 20px;line-height:1.45}' +

    '.meta{margin-bottom:24px}' +

    '.grid{display:grid;grid-template-columns:1fr 1fr;gap:24px}' +

    'table{width:100%;border-collapse:collapse}' +

    'th,td{border:1px solid #ccc;padding:9px;text-align:left;vertical-align:top}' +

    'thead th{background:#eee}' +

    '.source{font-size:.85em}' +

    '.notice{padding:10px;border:1px solid #ccc;margin:16px 0}' +

    '.email-form{margin-top:28px;padding:16px;border:1px solid #ccc;max-width:520px}' +

    '.email-form button{font:inherit;padding:10px;cursor:pointer}' +

    '@media(max-width:800px){.grid{grid-template-columns:1fr}}' +

    '</style>' +

    '</head>' +

    '<body>' +

    '<h1>Weather Advisor Report</h1>' +

    cacheNotice +

    '<div class="meta">' +

    '<strong>Location:</strong> ' +

    escape.escapeHtml(
      weather.location.city +
      ', ' +
      weather.location.state +
      ' ' +
      weather.location.zip
    ) +

    '<br>' +

    '<strong>Date:</strong> ' +

    escape.escapeHtml(
      weather.date
    ) +

    '<br>' +

    '<strong>Timezone:</strong> ' +

    escape.escapeHtml(
      weather.location
        .timezone
    ) +

    '<br>' +

    '<strong>Advice source:</strong> ' +

    escape.escapeHtml(
      adviceResult.source
    ) +

    (
      adviceResult.model
        ? (
            ' (' +
            escape.escapeHtml(
              adviceResult
                .model
            ) +
            ')'
          )
        : ''
    ) +

    '</div>' +

    (
      adviceResult.source ===
      'fallback'
        ? (
            '<div class="notice">' +

            'Gemini was unavailable, invalid, or unavailable by policy, so deterministic fallback advice is shown.' +

            '</div>'
          )
        : ''
    ) +

    '<div class="grid">' +

    renderPeriodTable(
      'Morning (06:00–11:59)',
      weather.morning,
      adviceResult
        .advice.morning,
      adviceResult.source
    ) +

    renderPeriodTable(
      'Night (18:00–23:59)',
      weather.night,
      adviceResult
        .advice.night,
      adviceResult.source
    ) +

    '</div>' +

    '<div class="email-form">' +

    '<h2>Email this report</h2>' +

    '<p>The report is sent only to the address entered for this request.</p>' +

    '<form method="post" action="/email">' +

    '<input type="hidden" name="zip" value="' +
    escape.escapeHtml(
      weather.location.zip
    ) +
    '">' +

    '<input type="hidden" name="date" value="' +
    escape.escapeHtml(
      weather.date
    ) +
    '">' +

    '<input type="hidden" name="clothingCategory" value="' +
    escape.escapeHtml(
      clothingCategory
    ) +
    '">' +

    '<input type="hidden" name="email" value="' +
    escape.escapeHtml(
      email
    ) +
    '">' +

    '<button type="submit">Email Report</button>' +

    '</form>' +

    '</div>' +

    '<p><a href="/">Create another report</a></p>' +

    '</body>' +
    '</html>'
  );
}

function renderEmailStatus(
  status
) {
  return (
    '<!doctype html>' +

    '<html lang="en">' +

    '<head>' +

    '<meta charset="utf-8">' +

    '<meta name="viewport" content="width=device-width, initial-scale=1">' +

    '<title>' +
    escape.escapeHtml(
      status.title
    ) +
    '</title>' +

    '</head>' +

    '<body style="font-family:Arial,sans-serif;max-width:760px;margin:40px auto;padding:0 20px">' +

    '<h1>' +
    escape.escapeHtml(
      status.title
    ) +
    '</h1>' +

    '<p>' +
    escape.escapeHtml(
      status.message
    ) +
    '</p>' +

    '<p><a href="/">Return to Weather Advisor</a></p>' +

    '</body>' +

    '</html>'
  );
}

function visitorIdentifier(
  req
) {
  return (
    req.ip ||
    'unknown'
  );
}

app.get(
  '/',
  function (req, res) {
    res.status(200)
      .send(
        renderForm(
          null
        )
      );
  }
);

app.get(
  '/health',
  function (req, res) {
    res.json({
      service:
        'advisor',

      status:
        'ok'
    });
  }
);

app.post(
  '/report',
  async function (
    req,
    res
  ) {
    var started =
      Date.now();

    var zip =
      String(
        req.body.zip ||
        ''
      );

    var date =
      String(
        req.body.date ||
        ''
      );

    var clothingCategory =
      String(
        req.body
          .clothingCategory ||
        ''
      );

    var email =
      validation
        .normalizeEmail(
          req.body.email
        );

    var zipCheck =
      validation
        .validateZip(
          zip
        );

    if (!zipCheck.ok) {
      return res
        .status(400)
        .send(
          renderForm(
            zipCheck.error
          )
        );
    }

    var dateCheck =
      validation
        .validateDate(
          date,
          currentDateString()
        );

    if (!dateCheck.ok) {
      return res
        .status(400)
        .send(
          renderForm(
            dateCheck.error
          )
        );
    }

    var clothingCheck =
      validation
        .validateClothingCategory(
          clothingCategory
        );

    if (!clothingCheck.ok) {
      return res
        .status(400)
        .send(
          renderForm(
            clothingCheck.error
          )
        );
    }

    var emailCheck =
      validation
        .validateEmail(
          email
        );

    if (!emailCheck.ok) {
      return res
        .status(400)
        .send(
          renderForm(
            emailCheck.error
          )
        );
    }

    /*
     * Email is intentionally not logged.
     */
    log(
      'report_request',
      {
        zip:
          zip,

        date:
          date,

        clothingCategory:
          clothingCategory
      }
    );

    var cached =
      await reportCache
        .findFreshReport(
          zip,
          date,
          clothingCategory
        );

    if (
      cached.state ===
        'ok' &&
      cached.value
    ) {
      log(
        'report_cache_hit',
        {
          zip:
            zip,

          date:
            date,

          clothingCategory:
            clothingCategory,

          ageSeconds:
            cached.value
              .ageSeconds,

          ms:
            Date.now() -
            started
        }
      );

      return res
        .status(200)
        .send(
          renderReport(
            cached.value
              .report.weather,

            cached.value
              .report
              .adviceResult,

            emailCheck.value,

            clothingCategory,

            {
              hit:
                true,

              ageSeconds:
                cached.value
                  .ageSeconds
            }
          )
        );
    }

    try {
      var weather =
        await weatherClient
          .getWeatherFacts(
            zip,
            date
          );

      var adviceResult =
        await getAdvice(
          weather,
          clothingCategory
        );

      var reportForCache = {
        weather:
          weather,

        adviceResult:
          adviceResult
      };

      var saved =
        await reportCache
          .saveReport(
            zip,
            date,
            clothingCategory,
            reportForCache
          );

      log(
        'report_success',
        {
          zip:
            zip,

          date:
            date,

          adviceSource:
            adviceResult
              .source,

          reportCache:
            saved.state,

          ms:
            Date.now() -
            started
        }
      );

      return res
        .status(200)
        .send(
          renderReport(
            weather,
            adviceResult,
            emailCheck.value,
            clothingCategory,
            {
              hit:
                false
            }
          )
        );
    } catch (err) {
      log(
        'report_error',
        {
          zip:
            zip,

          date:
            date,

          code:
            err.code ||
            null,

          status:
            err.status ||
            null,

          message:
            err.message
        }
      );

      if (
        err.status === 400 ||
        err.status === 404
      ) {
        return res
          .status(
            err.status
          )
          .send(
            renderForm(
              err.message
            )
          );
      }

      return res
        .status(502)
        .send(
          renderForm(
            'The weather service is temporarily unavailable. Please try again.'
          )
        );
    }
  }
);

app.post(
  '/email',
  async function (
    req,
    res
  ) {
    var zip =
      String(
        req.body.zip ||
        ''
      );

    var date =
      String(
        req.body.date ||
        ''
      );

    var clothingCategory =
      String(
        req.body
          .clothingCategory ||
        ''
      );

    var recipient =
      validation
        .normalizeEmail(
          req.body.email
        );

    var zipCheck =
      validation
        .validateZip(
          zip
        );

    var clothingCheck =
      validation
        .validateClothingCategory(
          clothingCategory
        );

    var emailCheck =
      validation
        .validateEmail(
          recipient
        );

    if (
      !zipCheck.ok ||
      !clothingCheck.ok ||
      !emailCheck.ok
    ) {
      return res
        .status(400)
        .send(
          renderEmailStatus({
            title:
              'Email request rejected',

            message:
              'The email request contained invalid input.'
          })
        );
    }

    /*
     * Never log recipient.
     */
    log(
      'email_request',
      {
        zip:
          zip,

        date:
          date,

        clothingCategory:
          clothingCategory
      }
    );

    var rate =
      await emailLimit
        .reserveEmail(
          visitorIdentifier(
            req
          )
        );

    if (!rate.allowed) {
      log(
        'email_limit_reached',
        {
          state:
            rate.state,

          limit:
            rate.limit
        }
      );

      var limited =
        emailStatus
          .statusForResult({
            state:
              rate.state
          });

      return res
        .status(
          limited.httpStatus
        )
        .send(
          renderEmailStatus(
            limited
          )
        );
    }

    /*
     * Only send a report that was already
     * generated and saved.
     *
     * This avoids calling Gemini again
     * merely because the user clicked
     * Email Report.
     */
    var cached =
      await reportCache
        .findFreshReport(
          zip,
          date,
          clothingCategory
        );

    if (
      cached.state !==
        'ok' ||
      !cached.value
    ) {
      return res
        .status(409)
        .send(
          renderEmailStatus({
            title:
              'Report unavailable',

            message:
              'The saved report is no longer available. Generate the report again before emailing it.'
          })
        );
    }

    try {
      var sendResult =
        await emailService
          .sendReport(
            emailCheck.value,

            cached.value
              .report.weather,

            cached.value
              .report
              .adviceResult
          );

      var status =
        emailStatus
          .statusForResult(
            sendResult
          );

      /*
       * No recipient is written to logs.
       */
      log(
        'email_result',
        {
          state:
            sendResult.state,

          zip:
            zip,

          date:
            date
        }
      );

      return res
        .status(
          status.httpStatus
        )
        .send(
          renderEmailStatus(
            status
          )
        );
    } catch (err) {
      log(
        'email_error',
        {
          name:
            err.name,

          message:
            err.message
        }
      );

      var failed =
        emailStatus
          .statusForResult({
            state:
              'failed'
          });

      return res
        .status(
          failed.httpStatus
        )
        .send(
          renderEmailStatus(
            failed
          )
        );
    }
  }
);

app.listen(
  PORT,
  function () {
    log(
      'advisor_started',
      {
        port:
          PORT,

        reportTable:
          process.env
            .REPORT_TABLE ||
          null,

        emailConfigured:
          Boolean(
            process.env
              .SES_FROM_EMAIL
          )
      }
    );
  }
);
