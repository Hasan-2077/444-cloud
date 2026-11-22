'use strict';

var http = require('http');
var https = require('https');

function sleep(ms) {
  return new Promise(function (resolve) {
    setTimeout(resolve, ms);
  });
}

function chooseClient(url) {
  return url.indexOf('https://') === 0
    ? https
    : http;
}

function requestJson(url, options, timeoutMs) {
  return new Promise(function (resolve, reject) {
    var client = chooseClient(url);

    var request = client.request(
      url,
      options || {},
      function (response) {
        var body = '';

        response.setEncoding('utf8');

        response.on('data', function (chunk) {
          body += chunk;
        });

        response.on('end', function () {
          var status =
            response.statusCode || 0;

          var data = null;

          if (body) {
            try {
              data = JSON.parse(body);
            } catch (err) {
              return reject(
                new Error(
                  'Invalid JSON response from ' +
                  url
                )
              );
            }
          }

          resolve({
            status: status,
            data: data
          });
        });
      }
    );

    request.setTimeout(
      timeoutMs || 8000,
      function () {
        request.destroy(
          new Error('Request timeout')
        );
      }
    );

    request.on('error', reject);

    if (
      options &&
      options.body
    ) {
      request.write(options.body);
    }

    request.end();
  });
}

async function fetchJson(stage, url, options) {
  var lastError = null;

  for (
    var attempt = 1;
    attempt <= 2;
    attempt += 1
  ) {
    try {
      return await requestJson(
        url,
        options,
        8000
      );
    } catch (err) {
      lastError = err;

      if (attempt < 2) {
        await sleep(500);
      }
    }
  }

  var error =
    new Error(stage + ' failed');

  error.stage = stage;
  error.cause = lastError;

  throw error;
}

module.exports = {
  fetchJson: fetchJson
};
