'use strict';

var assert = require('assert');
var prompt = require('../lib/prompt');

function sampleWeather() {
  return {
    date: '2026-11-18',

    location: {
      city: 'Chicago',
      state: 'IL'
    },

    morning: {
      temperature: {
        min: 45,
        max: 55,
        unit: 'F'
      },

      wind: {
        maxMph: 15
      },

      visibility: {
        minMiles: 10.6
      },

      uv: {
        maxIndex: 2.6
      },

      humidity: {
        averagePercent: 58.8
      },

      rain: {
        category: 'No'
      },

      snow: {
        category: 'No'
      }
    },

    night: {
      temperature: {
        min: 51,
        max: 53,
        unit: 'F'
      },

      wind: {
        maxMph: 15
      },

      visibility: {
        minMiles: 20.4
      },

      uv: {
        maxIndex: 0
      },

      humidity: {
        averagePercent: 57.8
      },

      rain: {
        category: 'No'
      },

      snow: {
        category: 'No'
      }
    }
  };
}

test(
  'prompt contains Morning and Night weather facts',
  function () {
    var result =
      prompt.buildAdvicePrompt(
        sampleWeather(),
        'neutral'
      );

    assert.ok(
      result.indexOf('"morning"') !== -1
    );

    assert.ok(
      result.indexOf('"night"') !== -1
    );
  }
);

test(
  'prompt contains clothing category',
  function () {
    var result =
      prompt.buildAdvicePrompt(
        sampleWeather(),
        'menswear'
      );

    assert.ok(
      result.indexOf(
        '"clothingCategory":"menswear"'
      ) !== -1
    );
  }
);

test(
  'prompt contains no email address',
  function () {
    var result =
      prompt.buildAdvicePrompt(
        sampleWeather(),
        'neutral'
      );

    assert.strictEqual(
      result.indexOf('@'),
      -1
    );
  }
);

test(
  'prompt forbids invented weather facts',
  function () {
    var result =
      prompt.buildAdvicePrompt(
        sampleWeather(),
        'neutral'
      );

    assert.ok(
      result.indexOf(
        'Do not invent or change measured weather values.'
      ) !== -1
    );
  }
);
