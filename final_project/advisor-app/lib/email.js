'use strict';

var escape =
  require('./escape');

var SES_FROM_EMAIL =
  String(
    process.env.SES_FROM_EMAIL ||
    ''
  ).trim()
    .toLowerCase();

var SES_REGION =
  process.env.SES_REGION ||
  process.env.AWS_REGION ||
  'us-east-2';

var sesClient = null;
var sesSdk = null;

function loadSes() {
  if (
    sesClient &&
    sesSdk
  ) {
    return {
      client:
        sesClient,

      sdk:
        sesSdk
    };
  }

  /*
   * Lazy-load the AWS SDK.
   * Local unit tests therefore do not
   * need AWS credentials or SES access.
   */
  sesSdk =
    require(
      '@aws-sdk/client-sesv2'
    );

  sesClient =
    new sesSdk.SESv2Client({
      region:
        SES_REGION,

      maxAttempts: 2
    });

  return {
    client:
      sesClient,

    sdk:
      sesSdk
  };
}

function safeText(value) {
  if (
    value === null ||
    value === undefined ||
    value === ''
  ) {
    return 'Not Available';
  }

  return String(value);
}

function periodText(
  title,
  period,
  advice
) {
  return [
    title,
    '',
    'Temperature: ' +
      safeText(
        period.temperature &&
        period.temperature.min
      ) +
      ' to ' +
      safeText(
        period.temperature &&
        period.temperature.max
      ) +
      ' F',

    'Wind: ' +
      safeText(
        period.wind &&
        period.wind.maxMph
      ) +
      ' mph',

    'Visibility: ' +
      safeText(
        period.visibility &&
        period.visibility.minMiles
      ) +
      ' miles',

    'UV: ' +
      safeText(
        period.uv &&
        period.uv.maxIndex
      ),

    'Humidity: ' +
      safeText(
        period.humidity &&
        period.humidity
          .averagePercent
      ) +
      '%',

    'Rain: ' +
      safeText(
        period.rain &&
        period.rain.category
      ),

    'Snow: ' +
      safeText(
        period.snow &&
        period.snow.category
      ),

    'Road conditions: ' +
      safeText(
        advice.road_conditions
      ),

    'Suggested dressing: ' +
      safeText(
        advice.dressing
      ),

    'Suggested accessories: ' +
      safeText(
        advice.accessories
      )
  ].join('\n');
}

function buildTextReport(
  weather,
  adviceResult
) {
  return [
    'Weather Advisor Report',
    '',
    'Location: ' +
      safeText(
        weather.location.city
      ) +
      ', ' +
      safeText(
        weather.location.state
      ) +
      ' ' +
      safeText(
        weather.location.zip
      ),

    'Date: ' +
      safeText(
        weather.date
      ),

    'Timezone: ' +
      safeText(
        weather.location.timezone
      ),

    'Advice source: ' +
      safeText(
        adviceResult.source
      ),

    '',
    periodText(
      'MORNING',
      weather.morning,
      adviceResult
        .advice.morning
    ),

    '',
    periodText(
      'NIGHT',
      weather.night,
      adviceResult
        .advice.night
    )
  ].join('\n');
}

function tableRow(
  label,
  value
) {
  return (
    '<tr>' +
    '<th style="text-align:left;padding:8px;border:1px solid #ccc">' +
    escape.escapeHtml(
      label
    ) +
    '</th>' +

    '<td style="padding:8px;border:1px solid #ccc">' +
    escape.escapeHtml(
      safeText(value)
    ) +
    '</td>' +
    '</tr>'
  );
}

function buildPeriodHtml(
  title,
  period,
  advice
) {
  return (
    '<h2>' +
    escape.escapeHtml(
      title
    ) +
    '</h2>' +

    '<table style="border-collapse:collapse;width:100%">' +

    tableRow(
      'Temperature',
      safeText(
        period.temperature &&
        period.temperature.min
      ) +
      ' to ' +
      safeText(
        period.temperature &&
        period.temperature.max
      ) +
      ' F'
    ) +

    tableRow(
      'Wind speed',
      period.wind
        ? (
            safeText(
              period.wind.maxMph
            ) +
            ' mph'
          )
        : 'Not Available'
    ) +

    tableRow(
      'Visibility',
      period.visibility
        ? (
            safeText(
              period.visibility.minMiles
            ) +
            ' miles'
          )
        : 'Not Available'
    ) +

    tableRow(
      'UV',
      period.uv
        ? period.uv.maxIndex
        : 'Not Available'
    ) +

    tableRow(
      'Humidity',
      period.humidity
        ? (
            safeText(
              period.humidity
                .averagePercent
            ) +
            '%'
          )
        : 'Not Available'
    ) +

    tableRow(
      'Rain',
      period.rain
        ? period.rain.category
        : 'Not Available'
    ) +

    tableRow(
      'Snow',
      period.snow
        ? period.snow.category
        : 'Not Available'
    ) +

    tableRow(
      'Suggested road conditions',
      advice.road_conditions
    ) +

    tableRow(
      'Suggested dressing',
      advice.dressing
    ) +

    tableRow(
      'Suggested accessories',
      advice.accessories
    ) +

    '</table>'
  );
}

function buildHtmlReport(
  weather,
  adviceResult
) {
  return (
    '<!doctype html>' +
    '<html>' +
    '<body style="font-family:Arial,sans-serif">' +

    '<h1>Weather Advisor Report</h1>' +

    '<p><strong>Location:</strong> ' +
    escape.escapeHtml(
      safeText(
        weather.location.city
      ) +
      ', ' +
      safeText(
        weather.location.state
      ) +
      ' ' +
      safeText(
        weather.location.zip
      )
    ) +
    '</p>' +

    '<p><strong>Date:</strong> ' +
    escape.escapeHtml(
      safeText(
        weather.date
      )
    ) +
    '</p>' +

    '<p><strong>Advice source:</strong> ' +
    escape.escapeHtml(
      safeText(
        adviceResult.source
      )
    ) +
    '</p>' +

    buildPeriodHtml(
      'Morning',
      weather.morning,
      adviceResult
        .advice.morning
    ) +

    buildPeriodHtml(
      'Night',
      weather.night,
      adviceResult
        .advice.night
    ) +

    '</body>' +
    '</html>'
  );
}

function buildSendCommand(
  recipient,
  weather,
  adviceResult
) {
  var email =
    String(
      recipient || ''
    ).trim()
      .toLowerCase();

  return {
    FromEmailAddress:
      SES_FROM_EMAIL,

    Destination: {
      ToAddresses: [
        email
      ]
    },

    Content: {
      Simple: {
        Subject: {
          Data:
            'Weather Advisor Report - ' +
            safeText(
              weather.date
            ),

          Charset:
            'UTF-8'
        },

        Body: {
          Text: {
            Data:
              buildTextReport(
                weather,
                adviceResult
              ),

            Charset:
              'UTF-8'
          },

          Html: {
            Data:
              buildHtmlReport(
                weather,
                adviceResult
              ),

            Charset:
              'UTF-8'
          }
        }
      }
    }
  };
}

async function getConsentStatus(
  email
) {
  var ses =
    loadSes();

  var result =
    await ses.client.send(
      new ses.sdk
        .GetEmailIdentityCommand({
          EmailIdentity:
            email
        })
    );

  return (
    result &&
    result.VerifiedForSendingStatus ===
      true
  );
}

async function startConsent(
  email
) {
  var ses =
    loadSes();

  await ses.client.send(
    new ses.sdk
      .CreateEmailIdentityCommand({
        EmailIdentity:
          email
      })
  );

  return {
    state:
      'pending_confirmation'
  };
}

async function ensureConsent(
  email
) {
  try {
    var verified =
      await getConsentStatus(
        email
      );

    if (verified) {
      return {
        state:
          'verified'
      };
    }

    return startConsent(
      email
    );
  } catch (err) {
    /*
     * An identity that does not yet exist
     * should start the verification process.
     */
    if (
      err.name ===
        'NotFoundException'
    ) {
      return startConsent(
        email
      );
    }

    throw err;
  }
}

async function sendReport(
  recipient,
  weather,
  adviceResult
) {
  if (!SES_FROM_EMAIL) {
    return {
      state:
        'disabled'
    };
  }

  var consent =
    await ensureConsent(
      recipient
    );

  if (
    consent.state !==
    'verified'
  ) {
    return consent;
  }

  var ses =
    loadSes();

  var input =
    buildSendCommand(
      recipient,
      weather,
      adviceResult
    );

  var result =
    await ses.client.send(
      new ses.sdk
        .SendEmailCommand(
          input
        )
    );

  return {
    state:
      'sent',

    messageId:
      result.MessageId ||
      null
  };
}

module.exports = {
  buildTextReport:
    buildTextReport,

  buildHtmlReport:
    buildHtmlReport,

  buildSendCommand:
    buildSendCommand,

  getConsentStatus:
    getConsentStatus,

  ensureConsent:
    ensureConsent,

  sendReport:
    sendReport
};
