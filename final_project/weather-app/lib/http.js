'use strict';

var https = require('https');

function sleep(ms) {
  return new Promise(function (resolve) {
    setTimeout(resolve, ms);
  });
}

function requestJson(url, headers, timeoutMs) {
  return new Promise(function (resolve, reject) {
    var request = https.get(
      url,
      {
        headers: headers || {}
      },
      function (response) {
        var body = '';

        response.setEncoding('utf8');

        response.on('data', function (chunk) {
          body += chunk;
        });

        response.on('end', function () {
          var status = response.statusCode || 0;

          if (status === 404) {
            return resolve({
              status: status,
              data: null
            });
          }

          if (status < 200 || status >= 300) {
            return reject(
              new Error('HTTP ' + status + ' from ' + url)
            );
          }

          try {
            resolve({
              status: status,
              data: JSON.parse(body)
            });
          } catch (err) {
            reject(
              new Error('Invalid JSON from ' + url)
            );
          }
        });
      }
    );

    request.setTimeout(timeoutMs || 8000, function () {
      request.destroy(new Error('Request timeout'));
    });

    request.on('error', reject);
  });
}

async function fetchJson(stage, url, headers) {
  var lastError = null;

  for (var attempt = 1; attempt <= 2; attempt += 1) {
    try {
      var result = await requestJson(
        url,
        headers,
        8000
      );

      return result;
    } catch (err) {
      lastError = err;

      if (attempt < 2) {
        await sleep(500);
      }
    }
  }

  var error = new Error(stage + ' failed');
  error.stage = stage;
  error.cause = lastError;

  throw error;
}

module.exports = {
  fetchJson: fetchJson
};
