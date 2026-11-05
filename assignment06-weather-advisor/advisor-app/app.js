const express = require('express');
const {
  SSMClient,
  GetParameterCommand,
} = require('@aws-sdk/client-ssm');

const app = express();

const PORT = Number(process.env.PORT || 3000);

const WEATHER_URL = process.env.WEATHER_URL;

const GEMINI_API_BASE =
  process.env.GEMINI_API_BASE ||
  'https://generativelanguage.googleapis.com';

const GEMINI_MODEL =
  process.env.GEMINI_MODEL ||
  'gemini-3.8-flash';

const KEY_PARAM =
  process.env.GEMINI_KEY_PARAM ||
  '/itmo-444-544/gemini-api-key';

const KEY_CACHE_MS =
  Number(process.env.KEY_CACHE_SECONDS || 60) * 1000;

const ssm = new SSMClient({
  region: process.env.AWS_REGION,
});

let cachedKey = {
  value: null,
  at: 0,
};


const log = (event, fields = {}) => {
  console.log(
    JSON.stringify({
      ts: new Date().toISOString(),
      event,
      ...fields,
    })
  );
};


async function getApiKey() {
  if (process.env.GEMINI_API_KEY) {
    return process.env.GEMINI_API_KEY;
  }

  if (
    cachedKey.value &&
    Date.now() - cachedKey.at < KEY_CACHE_MS
  ) {
    return cachedKey.value;
  }

  const out = await ssm.send(
    new GetParameterCommand({
      Name: KEY_PARAM,
      WithDecryption: true,
    })
  );

  cachedKey = {
    value: out.Parameter.Value,
    at: Date.now(),
  };

  return cachedKey.value;
}


const SYSTEM_PROMPT =
  'You give a short clothing suggestion for the weather you are given. ' +
  'Reply in at most two plain sentences, with no markdown and no lists. ' +
  'Use only the data provided.';


function buildPrompt(weather) {
  const forecast = weather.forecast;

  return [
    `Zip code: ${weather.zip} (${weather.city}, ${weather.state})`,
    `Period: ${forecast.name}`,
    `Temperature: ${forecast.temperature} ${forecast.temperatureUnit}`,
    `Conditions: ${forecast.shortForecast}`,
    `Wind: ${forecast.windSpeed}`,
    `Chance of precipitation: ${
      forecast.precipitationChance === null
        ? 'unknown'
        : forecast.precipitationChance + ' percent'
    }`,
  ].join('\n');
}


async function askGemini(prompt) {
  const key = await getApiKey();

  const response = await fetch(
    `${GEMINI_API_BASE}/v1beta/models/${GEMINI_MODEL}:generateContent`,
    {
      method: 'POST',

      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': key,
      },

      body: JSON.stringify({
        systemInstruction: {
          parts: [
            {
              text: SYSTEM_PROMPT,
            },
          ],
        },

        contents: [
          {
            parts: [
              {
                text: prompt,
              },
            ],
          },
        ],

        generationConfig: {
          maxOutputTokens: 300,
        },
      }),

      signal: AbortSignal.timeout(15000),
    }
  );

  if (!response.ok) {
    const err =
      new Error('gemini_http_error');

    err.status = response.status;

    throw err;
  }

  const data =
    await response.json();

  const parts =
    (
      data.candidates &&
      data.candidates[0] &&
      data.candidates[0].content &&
      data.candidates[0].content.parts
    ) || [];

  const text =
    parts
      .map((part) => part.text || '')
      .join('')
      .trim();

  if (!text) {
    const err =
      new Error('gemini_empty_response');

    err.status = 200;

    throw err;
  }

  return text;
}


function fallbackAdvice(forecast) {
  const temperature =
    forecast.temperature;

  let base;

  if (temperature <= 32) {
    base =
      'Wear a heavy coat, a hat and gloves.';
  } else if (temperature <= 50) {
    base =
      'Wear a warm jacket and long pants.';
  } else if (temperature <= 68) {
    base =
      'Wear a light jacket or a sweater over long sleeves.';
  } else if (temperature <= 80) {
    base =
      'A t-shirt and light pants or shorts will be fine.';
  } else {
    base =
      'Wear light, breathable clothes and bring water and sunscreen.';
  }

  const wet =
    (forecast.precipitationChance || 0) >= 40 ||
    /rain|shower|storm|snow/i.test(
      forecast.shortForecast
    );

  if (wet) {
    return (
      `${base} ` +
      'Bring an umbrella or a waterproof jacket.'
    );
  }

  return base;
}


const escapeHtml = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (char) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      })[char]
  );


async function getAdvice(zip) {
  if (!/^\d{5}$/.test(zip)) {
    log('advice_rejected', {
      reason: 'invalid_zip',
    });

    return {
      status: 400,

      body: {
        error: 'invalid_zip',
        message:
          'Give a 5 digit US zip code.',
      },
    };
  }

  const started = Date.now();

  log('advice_request', {
    zip,
  });

  let weather;

  try {
    const response =
      await fetch(
        `${WEATHER_URL}/weather?zip=${zip}`,
        {
          signal:
            AbortSignal.timeout(20000),
        }
      );

    if (
      response.status === 400 ||
      response.status === 404
    ) {
      log('advice_rejected', {
        reason:
          'weather_' + response.status,
        zip,
      });

      return {
        status: response.status,
        body: await response.json(),
      };
    }

    if (!response.ok) {
      throw new Error(
        'weather_status_' +
          response.status
      );
    }

    weather =
      await response.json();
  } catch (err) {
    log('weather_call_failed', {
      zip,
      message: err.message,
    });

    return {
      status: 502,

      body: {
        error:
          'weather_service_unavailable',
      },
    };
  }

  let advice;
  let source;

  try {
    advice =
      await askGemini(
        buildPrompt(weather)
      );

    source = 'gemini';
  } catch (err) {
    log('gemini_error', {
      zip,

      status:
        err.status || 0,

      reason:
        err.name === 'TimeoutError'
          ? 'timeout'
          : err.message,
    });

    advice =
      fallbackAdvice(
        weather.forecast
      );

    source = 'fallback';
  }

  log('advice_success', {
    zip,
    source,
    ms:
      Date.now() -
      started,
  });

  return {
    status: 200,

    body: {
      ...weather,

      advice,

      source,

      model:
        source === 'gemini'
          ? GEMINI_MODEL
          : null,
    },
  };
}


app.get(
  '/advice',
  async (req, res) => {
    const {
      status,
      body,
    } =
      await getAdvice(
        String(req.query.zip || '')
      );

    res
      .status(status)
      .json(body);
  }
);


app.get(
  '/',
  async (req, res) => {
    const form = `
      <form method="GET" action="/">
        <label>
          US zip code
          <input
            name="zip"
            pattern="[0-9]{5}"
            maxlength="5"
            required
          >
        </label>

        <button type="submit">
          What should I wear?
        </button>
      </form>
    `;

    let result = '';

    if (req.query.zip) {
      const {
        status,
        body,
      } =
        await getAdvice(
          String(req.query.zip)
        );

      if (status === 200) {
        const forecast =
          body.forecast;

        result = `
          <h2>
            ${escapeHtml(body.city)},
            ${escapeHtml(body.state)}
            ${escapeHtml(body.zip)}
          </h2>

          <p>
            ${escapeHtml(forecast.name)}:
            ${escapeHtml(forecast.temperature)}
            ${escapeHtml(forecast.temperatureUnit)},
            ${escapeHtml(forecast.shortForecast)},
            wind ${escapeHtml(forecast.windSpeed)}
          </p>

          <p>
            <strong>
              ${escapeHtml(body.advice)}
            </strong>
          </p>

          <p>
            <small>
              Suggestion source:
              ${escapeHtml(body.source)}
            </small>
          </p>
        `;
      } else {
        result = `
          <p>
            Sorry:
            ${escapeHtml(body.error)}
          </p>
        `;
      }
    }

    res
      .status(200)
      .send(`
        <h1>Weather Advisor</h1>
        ${form}
        ${result}
      `);
  }
);


app.listen(PORT, () => {
  log('advisor_started', {
    port: PORT,
    model: GEMINI_MODEL,
  });
});
