'use strict';

var http = require('./http');
var validation = require('./validation');
var aggregation = require('./aggregation');
var precipitation = require('./precipitation');
var units = require('./units');

var ZIP_API =
  process.env.ZIP_API_BASE ||
  'https://api.zippopotam.us';

var NWS_API =
  process.env.NWS_API_BASE ||
  'https://api.weather.gov';

var OPEN_METEO_API =
  process.env.OPEN_METEO_API_BASE ||
  'https://api.open-meteo.com/v1/forecast';

var USER_AGENT =
  process.env.NWS_USER_AGENT ||
  '(Graduate Weather Advisor, student@example.com)';

function parseWindSpeed(text) {
  if (typeof text !== 'string') {
    return null;
  }

  var matches = text.match(/\d+/g);

  if (!matches || matches.length === 0) {
    return null;
  }

  return Math.max.apply(
    null,
    matches.map(function (value) {
      return Number(value);
    })
  );
}

function formatLocalDateTime(isoString, timeZone) {
  var date = new Date(isoString);

  var formatter = new Intl.DateTimeFormat(
    'en-CA',
    {
      timeZone: timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      hour12: false
    }
  );

  var parts = formatter.formatToParts(date);
  var out = {};

  parts.forEach(function (part) {
    out[part.type] = part.value;
  });

  return {
    date:
      out.year + '-' +
      out.month + '-' +
      out.day,

    hour: Number(out.hour)
  };
}

function buildNwsRecords(periods, timeZone, dateString) {
  return periods
    .map(function (period) {
      var local = formatLocalDateTime(
        period.startTime,
        timeZone
      );

      var humidity =
        period.relativeHumidity &&
        typeof period.relativeHumidity.value === 'number'
          ? period.relativeHumidity.value
          : null;

      var precipitationProbability =
        period.probabilityOfPrecipitation &&
        typeof period.probabilityOfPrecipitation.value === 'number'
          ? period.probabilityOfPrecipitation.value
          : null;

      return {
        localDate: local.date,
        localHour: local.hour,
        temperature:
          typeof period.temperature === 'number'
            ? period.temperature
            : null,
        windMph: parseWindSpeed(period.windSpeed),
        humidity: humidity,
        precipitationProbability:
          precipitationProbability
      };
    })
    .filter(function (record) {
      return record.localDate === dateString;
    });
}

function buildOpenMeteoRecords(hourly, dateString) {
  var records = [];
  var times = hourly.time || [];

  for (var i = 0; i < times.length; i += 1) {
    var parts = times[i].split('T');
    var date = parts[0];
    var hour = Number(parts[1].slice(0, 2));

    if (date !== dateString) {
      continue;
    }

    records.push({
      localDate: date,
      localHour: hour,
      visibilityMeters:
        hourly.visibility &&
        typeof hourly.visibility[i] === 'number'
          ? hourly.visibility[i]
          : null,

      uv:
        hourly.uv_index &&
        typeof hourly.uv_index[i] === 'number'
          ? hourly.uv_index[i]
          : null,

      rainMm:
        hourly.rain &&
        typeof hourly.rain[i] === 'number'
          ? hourly.rain[i]
          : null,

      snowfallCm:
        hourly.snowfall &&
        typeof hourly.snowfall[i] === 'number'
          ? hourly.snowfall[i]
          : null
    });
  }

  return records;
}

function selectHours(records, startHour, endHour) {
  return records.filter(function (record) {
    return (
      record.localHour >= startHour &&
      record.localHour <= endHour
    );
  });
}

function aggregatePeriod(nwsRecords, openRecords) {
  var temperatures =
    nwsRecords.map(function (r) {
      return r.temperature;
    });

  var winds =
    nwsRecords.map(function (r) {
      return r.windMph;
    });

  var humidity =
    nwsRecords.map(function (r) {
      return r.humidity;
    });

  var precipProbabilities =
    nwsRecords.map(function (r) {
      return r.precipitationProbability;
    });

  var visibility =
    openRecords.map(function (r) {
      return r.visibilityMeters;
    });

  var uv =
    openRecords.map(function (r) {
      return r.uv;
    });

  var rain =
    openRecords.map(function (r) {
      return r.rainMm;
    });

  var snow =
    openRecords.map(function (r) {
      return r.snowfallCm;
    });

  var tempRange =
    aggregation.minMax(temperatures);

  var maxWind =
    aggregation.maximum(winds);

  var meanHumidity =
    aggregation.average(humidity);

  var minVisibilityMeters =
    aggregation.minimum(visibility);

  var maxUv =
    aggregation.maximum(uv);

  var maxHourlyRain =
    aggregation.maximum(rain);

  var totalSnow =
    aggregation.sum(snow);

  var maxPrecipProbability =
    aggregation.maximum(precipProbabilities);

  return {
    temperature: tempRange
      ? {
          min: tempRange.min,
          max: tempRange.max,
          unit: 'F',
          source: 'NWS'
        }
      : null,

    wind: maxWind !== null
      ? {
          maxMph: maxWind,
          source: 'NWS'
        }
      : null,

    visibility:
      minVisibilityMeters !== null
        ? {
            minMeters: minVisibilityMeters,
            minMiles:
              units.metersToMiles(
                minVisibilityMeters
              ),
            source: 'Open-Meteo'
          }
        : null,

    uv:
      maxUv !== null
        ? {
            maxIndex: maxUv,
            source: 'Open-Meteo'
          }
        : null,

    humidity:
      meanHumidity !== null
        ? {
            averagePercent:
              Math.round(meanHumidity * 10) / 10,
            source: 'NWS'
          }
        : null,

    rain: {
      category:
        precipitation.classifyRain(
          maxHourlyRain,
          maxPrecipProbability
        ),
      maxHourlyMm: maxHourlyRain,
      probabilityPercent:
        maxPrecipProbability,
      source:
        'Open-Meteo amount + NWS probability'
    },

    snow: {
      category:
        precipitation.classifySnow(
          totalSnow
        ),
      totalCm: totalSnow,
      source: 'Open-Meteo'
    }
  };
}

async function getWeatherReport(zip, dateString) {
  var zipResult =
    validation.validateZip(zip);

  if (!zipResult.ok) {
    var zipError =
      new Error(zipResult.error);

    zipError.code = 'invalid_zip';
    zipError.status = 400;

    throw zipError;
  }

  var lookupResult =
    await http.fetchJson(
      'zip_lookup',
      ZIP_API + '/us/' + zip
    );

  if (
    !lookupResult.data ||
    !lookupResult.data.places ||
    lookupResult.data.places.length === 0
  ) {
    var notFound =
      new Error('ZIP code not found.');

    notFound.code = 'zip_not_found';
    notFound.status = 404;

    throw notFound;
  }

  var place =
    lookupResult.data.places[0];

  var latitude =
    Number(place.latitude);

  var longitude =
    Number(place.longitude);

  var nwsHeaders = {
    'User-Agent': USER_AGENT,
    Accept: 'application/geo+json'
  };

  var pointResult =
    await http.fetchJson(
      'nws_points',
      NWS_API +
        '/points/' +
        latitude.toFixed(4) +
        ',' +
        longitude.toFixed(4),
      nwsHeaders
    );

  if (
    !pointResult.data ||
    !pointResult.data.properties
  ) {
    var coverageError =
      new Error('No NWS coverage.');

    coverageError.code =
      'no_nws_coverage';

    coverageError.status = 404;

    throw coverageError;
  }

  var point =
    pointResult.data.properties;

  var timeZone =
    point.timeZone;

  var hourlyResult =
    await http.fetchJson(
      'nws_hourly',
      point.forecastHourly,
      nwsHeaders
    );

  var openMeteoUrl =
    OPEN_METEO_API +
    '?latitude=' +
    encodeURIComponent(latitude) +
    '&longitude=' +
    encodeURIComponent(longitude) +
    '&timezone=' +
    encodeURIComponent(timeZone) +
    '&forecast_days=7' +
    '&hourly=' +
    encodeURIComponent(
      [
        'visibility',
        'uv_index',
        'rain',
        'snowfall'
      ].join(',')
    );

  var openResult =
    await http.fetchJson(
      'open_meteo',
      openMeteoUrl
    );

  var nwsRecords =
    buildNwsRecords(
      hourlyResult.data.properties.periods,
      timeZone,
      dateString
    );

  var openRecords =
    buildOpenMeteoRecords(
      openResult.data.hourly,
      dateString
    );

  var morningNws =
    selectHours(
      nwsRecords,
      6,
      11
    );

  var nightNws =
    selectHours(
      nwsRecords,
      18,
      23
    );

  var morningOpen =
    selectHours(
      openRecords,
      6,
      11
    );

  var nightOpen =
    selectHours(
      openRecords,
      18,
      23
    );

  return {
    location: {
      zip: zip,
      city: place['place name'],
      state:
        place['state abbreviation'],
      latitude: latitude,
      longitude: longitude,
      timezone: timeZone
    },

    date: dateString,

    morning:
      aggregatePeriod(
        morningNws,
        morningOpen
      ),

    night:
      aggregatePeriod(
        nightNws,
        nightOpen
      ),

    sources: {
      zip:
        'Zippopotam.us',

      temperature:
        'NWS',

      wind:
        'NWS',

      humidity:
        'NWS',

      precipitationProbability:
        'NWS',

      visibility:
        'Open-Meteo',

      uv:
        'Open-Meteo',

      rainAmount:
        'Open-Meteo',

      snowfall:
        'Open-Meteo'
    },

    generatedAt:
      new Date().toISOString()
  };
}

module.exports = {
  parseWindSpeed: parseWindSpeed,
  formatLocalDateTime: formatLocalDateTime,
  buildNwsRecords: buildNwsRecords,
  buildOpenMeteoRecords:
    buildOpenMeteoRecords,
  aggregatePeriod: aggregatePeriod,
  getWeatherReport:
    getWeatherReport
};
