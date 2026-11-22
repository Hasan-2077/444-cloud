'use strict';

var http = require('./http');

var WEATHER_URL =
  process.env.WEATHER_URL ||
  'http://localhost:3000';

async function getWeatherFacts(zip, date) {
  var url =
    WEATHER_URL +
    '/weather?zip=' +
    encodeURIComponent(zip) +
    '&date=' +
    encodeURIComponent(date);

  var result =
    await http.fetchJson(
      'weather_service',
      url,
      {
        method: 'GET'
      }
    );

  if (result.status === 400) {
    var error400 =
      new Error(
        result.data &&
        result.data.message
          ? result.data.message
          : 'Invalid weather request.'
      );

    error400.status = 400;
    error400.code =
      result.data &&
      result.data.error
        ? result.data.error
        : 'invalid_request';

    throw error400;
  }

  if (result.status === 404) {
    var error404 =
      new Error(
        result.data &&
        result.data.message
          ? result.data.message
          : 'Weather location not found.'
      );

    error404.status = 404;
    error404.code =
      result.data &&
      result.data.error
        ? result.data.error
        : 'not_found';

    throw error404;
  }

  if (
    result.status < 200 ||
    result.status >= 300
  ) {
    var upstream =
      new Error(
        'Weather service unavailable.'
      );

    upstream.status = 502;
    upstream.code =
      'weather_service_unavailable';

    throw upstream;
  }

  return result.data;
}

module.exports = {
  getWeatherFacts: getWeatherFacts
};
