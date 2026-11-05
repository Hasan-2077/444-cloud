const fs = require('fs');
const express = require('express');
const { Pool } = require('pg');
const {
  SSMClient,
  GetParameterCommand,
} = require('@aws-sdk/client-ssm');

const app = express();

const PORT = Number(process.env.PORT || 3000);

const ZIP_API =
  process.env.ZIP_API_BASE || 'https://api.zippopotam.us';

const NWS_API =
  process.env.NWS_API_BASE || 'https://api.weather.gov';

const USER_AGENT =
  process.env.NWS_USER_AGENT ||
  '(itmo-444-544 weather lab, student@example.com)';

const DB_HOST = process.env.DB_HOST;
const DB_PORT = Number(process.env.DB_PORT || 5432);
const DB_NAME = process.env.DB_NAME || 'weather';
const DB_USER = process.env.DB_USER || 'weatherapp';

const DB_PASSWORD_PARAM =
  process.env.DB_PASSWORD_PARAM ||
  '/itmo-444-544/db-password';

const DB_CA_FILE =
  process.env.DB_CA_FILE ||
  '/opt/app/rds-ca.pem';

const CACHE_SECONDS =
  Number(process.env.CACHE_SECONDS || 600);

const DB_RETRY_MS = 30000;

const ssm = new SSMClient({
  region: process.env.AWS_REGION,
});

let pool = null;
let dbUnavailableUntil = 0;


const log = (event, fields = {}) => {
  console.log(
    JSON.stringify({
      ts: new Date().toISOString(),
      event,
      ...fields,
    })
  );
};


class UpstreamError extends Error {
  constructor(stage, status) {
    super(`${stage} failed`);
    this.stage = stage;
    this.status = status;
  }
}


async function fetchJson(stage, url, headers = {}) {
  let lastError = null;

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const controller = new AbortController();

    const timer = setTimeout(() => {
      controller.abort();
    }, 8000);

    try {
      const response = await fetch(url, {
        headers,
        signal: controller.signal,
      });

      clearTimeout(timer);

      if (response.status === 404) {
        return null;
      }

      if (!response.ok) {
        lastError = new UpstreamError(
          stage,
          response.status
        );

        if (attempt === 2) {
          throw lastError;
        }

        continue;
      }

      return await response.json();
    } catch (err) {
      clearTimeout(timer);

      if (err instanceof UpstreamError) {
        lastError = err;
      } else {
        lastError = new UpstreamError(
          stage,
          err.name === 'AbortError'
            ? 'timeout'
            : 'network'
        );
      }

      if (attempt === 2) {
        throw lastError;
      }
    }
  }

  throw lastError;
}


async function getDatabasePassword() {
  const result = await ssm.send(
    new GetParameterCommand({
      Name: DB_PASSWORD_PARAM,
      WithDecryption: true,
    })
  );

  return result.Parameter.Value;
}


async function createPool() {
  if (!DB_HOST) {
    return null;
  }

  if (Date.now() < dbUnavailableUntil) {
    return null;
  }

  try {
    const password =
      await getDatabasePassword();

    const ca = fs.readFileSync(
      DB_CA_FILE,
      'utf8'
    );

    const newPool = new Pool({
      host: DB_HOST,
      port: DB_PORT,
      database: DB_NAME,
      user: DB_USER,
      password,

      ssl: {
        rejectUnauthorized: true,
        ca,
      },

      connectionTimeoutMillis: 3000,
      statement_timeout: 3000,
    });

    await newPool.query(`
      CREATE TABLE IF NOT EXISTS lookups (
        id BIGSERIAL PRIMARY KEY,
        zip VARCHAR(5) NOT NULL,
        payload JSONB NOT NULL,
        created_at TIMESTAMPTZ
          NOT NULL DEFAULT NOW()
      )
    `);

    await newPool.query(`
      CREATE INDEX IF NOT EXISTS
        idx_lookups_zip_created
      ON lookups(zip, created_at DESC)
    `);

    pool = newPool;

    return pool;
  } catch (err) {
    dbUnavailableUntil =
      Date.now() + DB_RETRY_MS;

    pool = null;

    log('db_error', {
      stage: 'connect',
      message: err.message,
    });

    return null;
  }
}


async function getPool() {
  if (!DB_HOST) {
    return null;
  }

  if (Date.now() < dbUnavailableUntil) {
    return null;
  }

  if (pool) {
    return pool;
  }

  return createPool();
}


async function withDb(operation, fn) {
  if (!DB_HOST) {
    return {
      state: 'disabled',
      value: null,
    };
  }

  if (Date.now() < dbUnavailableUntil) {
    return {
      state: 'unavailable',
      value: null,
    };
  }

  try {
    const db = await getPool();

    if (!db) {
      return {
        state: 'unavailable',
        value: null,
      };
    }

    const value = await fn(db);

    return {
      state: 'ok',
      value,
    };
  } catch (err) {
    dbUnavailableUntil =
      Date.now() + DB_RETRY_MS;

    if (pool) {
      try {
        await pool.end();
      } catch (_) {
        // ignore cleanup error
      }
    }

    pool = null;

    log('db_error', {
      stage: operation,
      message: err.message,
    });

    return {
      state: 'unavailable',
      value: null,
    };
  }
}


async function findFresh(zip) {
  return withDb(
    'cache_lookup',
    async (db) => {
      const result = await db.query(
        `
        SELECT payload
        FROM lookups
        WHERE zip = $1
          AND created_at >
            NOW() -
            ($2 * INTERVAL '1 second')
        ORDER BY created_at DESC
        LIMIT 1
        `,
        [
          zip,
          CACHE_SECONDS,
        ]
      );

      if (result.rows.length === 0) {
        return null;
      }

      return result.rows[0].payload;
    }
  );
}


async function saveLookup(zip, payload) {
  return withDb(
    'cache_save',
    async (db) => {
      await db.query(
        `
        INSERT INTO lookups
          (zip, payload)
        VALUES
          ($1, $2::jsonb)
        `,
        [
          zip,
          JSON.stringify(payload),
        ]
      );

      return true;
    }
  );
}


app.get('/', (req, res) => {
  res.json({
    service: 'weather',
    status: 'ok',
    endpoints: [
      '/weather?zip=60616',
      '/history',
    ],
  });
});


app.get('/history', async (req, res) => {
  const result = await withDb(
    'history',
    async (db) => {
      const query = await db.query(`
        SELECT
          id,
          zip,
          payload->>'city' AS city,
          payload->>'state' AS state,
          payload->'forecast'
            ->>'shortForecast'
            AS short_forecast,
          payload->'forecast'
            ->>'temperature'
            AS temperature,
          created_at
        FROM lookups
        ORDER BY created_at DESC
        LIMIT 10
      `);

      return query.rows;
    }
  );

  if (result.state === 'disabled') {
    return res.status(503).json({
      error: 'database_disabled',
    });
  }

  if (result.state === 'unavailable') {
    return res.status(503).json({
      error: 'database_unavailable',
    });
  }

  return res.json({
    count: result.value.length,
    lookups: result.value,
  });
});


app.get('/weather', async (req, res) => {
  const zip =
    String(req.query.zip || '');

  if (!/^\d{5}$/.test(zip)) {
    log('weather_rejected', {
      reason: 'invalid_zip',
    });

    return res.status(400).json({
      error: 'invalid_zip',
      message:
        'Give a 5 digit US zip code.',
    });
  }

  const started = Date.now();

  log('weather_request', {
    zip,
  });

  const cached =
    await findFresh(zip);

  if (
    cached.state === 'ok' &&
    cached.value
  ) {
    log('weather_success', {
      zip,
      cache: 'hit',
      ms: Date.now() - started,
    });

    return res.json({
      ...cached.value,
      cache: 'hit',
    });
  }

  try {
    const lookup =
      await fetchJson(
        'zip_lookup',
        `${ZIP_API}/us/${zip}`
      );

    if (
      !lookup ||
      !lookup.places ||
      lookup.places.length === 0
    ) {
      log('weather_rejected', {
        reason: 'zip_not_found',
        zip,
      });

      return res.status(404).json({
        error: 'zip_not_found',
      });
    }

    const place =
      lookup.places[0];

    const lat =
      Number(
        place.latitude
      ).toFixed(4);

    const lon =
      Number(
        place.longitude
      ).toFixed(4);

    const headers = {
      'User-Agent': USER_AGENT,
      Accept:
        'application/geo+json',
    };

    const point =
      await fetchJson(
        'nws_points',
        `${NWS_API}/points/${lat},${lon}`,
        headers
      );

    if (!point) {
      log('weather_rejected', {
        reason:
          'no_nws_coverage',
        zip,
      });

      return res.status(404).json({
        error:
          'no_nws_coverage',
      });
    }

    const forecast =
      await fetchJson(
        'nws_forecast',
        point.properties.forecast,
        headers
      );

    const period =
      forecast.properties.periods[0];

    const precip =
      period.probabilityOfPrecipitation
        ? period
            .probabilityOfPrecipitation
            .value
        : null;

    const body = {
      zip,

      city:
        place['place name'],

      state:
        place[
          'state abbreviation'
        ],

      latitude: lat,
      longitude: lon,

      forecast: {
        name: period.name,

        temperature:
          period.temperature,

        temperatureUnit:
          period.temperatureUnit,

        shortForecast:
          period.shortForecast,

        windSpeed:
          period.windSpeed,

        precipitationChance:
          precip,

        isDaytime:
          period.isDaytime,
      },
    };

    const saved =
      await saveLookup(
        zip,
        body
      );

    const cache =
      saved.state === 'ok'
        ? 'miss'
        : 'unavailable';

    log('weather_success', {
      zip,
      cache,
      ms:
        Date.now() -
        started,
    });

    return res.json({
      ...body,
      cache,
    });
  } catch (err) {
    if (
      err instanceof
      UpstreamError
    ) {
      log('weather_error', {
        zip,
        stage: err.stage,
        status: err.status,
      });

      return res
        .status(502)
        .json({
          error:
            'upstream_error',
          stage:
            err.stage,
        });
    }

    log('weather_error', {
      zip,
      stage: 'internal',
      message:
        err.message,
    });

    return res
      .status(500)
      .json({
        error:
          'internal_error',
      });
  }
});


app.listen(PORT, () => {
  log('weather_started', {
    port: PORT,
  });
});
