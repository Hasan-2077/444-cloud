'use strict';

var https = require('https');

var GEMINI_API_BASE =
  process.env.GEMINI_API_BASE ||
  'https://generativelanguage.googleapis.com';

var GEMINI_MODEL =
  process.env.GEMINI_MODEL ||
  'gemini-3.8-flash';

var GEMINI_KEY_PARAM =
  process.env.GEMINI_KEY_PARAM ||
  '/itmo-444-544/gemini-api-key';

var KEY_CACHE_MS =
  Number(
    process.env.KEY_CACHE_SECONDS || 60
  ) * 1000;

var cachedKey = {
  value: null,
  at: 0
};

var ssmClient = null;

function sleep(ms) {
  return new Promise(function (resolve) {
    setTimeout(resolve, ms);
  });
}

function getSsmObjects() {
  /*
   * Lazy-load the AWS SDK.
   *
   * This keeps local Node 12 testing from parsing the
   * newer AWS SDK unless SSM is actually required.
   * Production EC2 will use the supported Node runtime.
   */
  var sdk =
    require('@aws-sdk/client-ssm');

  if (!ssmClient) {
    ssmClient =
      new sdk.SSMClient({
        region:
          process.env.AWS_REGION
      });
  }

  return {
    client: ssmClient,
    GetParameterCommand:
      sdk.GetParameterCommand
  };
}

async function getApiKey() {
  /*
   * Local development/testing can inject a key directly.
   * Production reads the encrypted value from SSM.
   */
  if (process.env.GEMINI_API_KEY) {
    return process.env.GEMINI_API_KEY;
  }

  if (
    cachedKey.value &&
    Date.now() - cachedKey.at <
      KEY_CACHE_MS
  ) {
    return cachedKey.value;
  }

  var objects =
    getSsmObjects();

  var result =
    await objects.client.send(
      new objects.GetParameterCommand({
        Name: GEMINI_KEY_PARAM,
        WithDecryption: true
      })
    );

  if (
    !result.Parameter ||
    !result.Parameter.Value
  ) {
    throw new Error(
      'Gemini key is unavailable.'
    );
  }

  cachedKey = {
    value:
      result.Parameter.Value,
    at:
      Date.now()
  };

  return cachedKey.value;
}

function postJson(
  url,
  apiKey,
  payload
) {
  return new Promise(
    function (resolve, reject) {
      var parsed =
        new URL(url);

      var body =
        JSON.stringify(payload);

      var request =
        https.request(
          {
            protocol:
              parsed.protocol,

            hostname:
              parsed.hostname,

            port:
              parsed.port || 443,

            path:
              parsed.pathname +
              parsed.search,

            method:
              'POST',

            headers: {
              'Content-Type':
                'application/json',

              'Content-Length':
                Buffer.byteLength(
                  body
                ),

              'x-goog-api-key':
                apiKey
            }
          },

          function (response) {
            var responseBody = '';

            response.setEncoding(
              'utf8'
            );

            response.on(
              'data',
              function (chunk) {
                responseBody += chunk;
              }
            );

            response.on(
              'end',
              function () {
                var status =
                  response.statusCode ||
                  0;

                var data = null;

                try {
                  data =
                    responseBody
                      ? JSON.parse(
                          responseBody
                        )
                      : {};
                } catch (err) {
                  return reject(
                    new Error(
                      'Gemini returned invalid JSON.'
                    )
                  );
                }

                if (
                  status < 200 ||
                  status >= 300
                ) {
                  var httpError =
                    new Error(
                      'Gemini HTTP ' +
                      status
                    );

                  httpError.status =
                    status;

                  httpError.response =
                    data;

                  return reject(
                    httpError
                  );
                }

                resolve(data);
              }
            );
          }
        );

      request.setTimeout(
        10000,
        function () {
          request.destroy(
            new Error(
              'Gemini request timeout'
            )
          );
        }
      );

      request.on(
        'error',
        reject
      );

      request.write(body);
      request.end();
    }
  );
}

function extractText(response) {
  if (
    !response ||
    !response.candidates ||
    !response.candidates.length ||
    !response.candidates[0].content ||
    !response.candidates[0]
      .content.parts ||
    !response.candidates[0]
      .content.parts.length
  ) {
    throw new Error(
      'Gemini returned no usable answer.'
    );
  }

  var text =
    response.candidates[0]
      .content.parts
      .map(function (part) {
        return part.text || '';
      })
      .join('')
      .trim();

  if (!text) {
    throw new Error(
      'Gemini returned an empty answer.'
    );
  }

  return text;
}

function stripCodeFence(text) {
  var cleaned =
    String(text || '')
      .trim();

  if (
    cleaned.indexOf('```') === 0
  ) {
    cleaned =
      cleaned.replace(
        /^```(?:json)?\s*/i,
        ''
      );

    cleaned =
      cleaned.replace(
        /\s*```$/,
        ''
      );
  }

  return cleaned.trim();
}

async function generateAdvice(prompt) {
  var apiKey =
    await getApiKey();

  var url =
    GEMINI_API_BASE +
    '/v1beta/models/' +
    encodeURIComponent(
      GEMINI_MODEL
    ) +
    ':generateContent';

  var payload = {
    contents: [
      {
        role: 'user',
        parts: [
          {
            text: prompt
          }
        ]
      }
    ],

    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 700,
      responseMimeType:
        'application/json'
    }
  };

  var lastError = null;

  for (
    var attempt = 1;
    attempt <= 2;
    attempt += 1
  ) {
    try {
      var response =
        await postJson(
          url,
          apiKey,
          payload
        );

      var text =
        stripCodeFence(
          extractText(response)
        );

      return {
        advice:
          JSON.parse(text),

        model:
          GEMINI_MODEL
      };
    } catch (err) {
      lastError = err;

      if (
        err.status &&
        err.status >= 400 &&
        err.status < 500 &&
        err.status !== 429
      ) {
        break;
      }

      if (attempt < 2) {
        await sleep(500);
      }
    }
  }

  throw (
    lastError ||
    new Error(
      'Gemini request failed.'
    )
  );
}

module.exports = {
  getApiKey:
    getApiKey,

  extractText:
    extractText,

  stripCodeFence:
    stripCodeFence,

  generateAdvice:
    generateAdvice
};
