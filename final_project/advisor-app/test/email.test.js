'use strict';

var assert =
  require('assert');

var email =
  require('../lib/email');

function sampleWeather() {
  return {
    date:
      '2026-11-22',

    location: {
      zip:
        '60616',

      city:
        'Chicago',

      state:
        'IL',

      timezone:
        'America/Chicago'
    },

    morning: {
      temperature: {
        min: 40,
        max: 50
      },

      wind: {
        maxMph: 15
      },

      visibility: {
        minMiles: 8
      },

      uv: {
        maxIndex: 2
      },

      humidity: {
        averagePercent: 60
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
        min: 35,
        max: 42
      },

      wind: {
        maxMph: 10
      },

      visibility: {
        minMiles: 10
      },

      uv: {
        maxIndex: 0
      },

      humidity: {
        averagePercent: 70
      },

      rain: {
        category: 'Mild'
      },

      snow: {
        category: 'No'
      }
    }
  };
}

function sampleAdvice() {
  return {
    source:
      'gemini',

    advice: {
      morning: {
        road_conditions:
          'Roads should be dry.',

        dressing:
          'Wear a jacket.',

        accessories:
          'Carry sunglasses.'
      },

      night: {
        road_conditions:
          'Roads may become wet.',

        dressing:
          'Wear warm layers.',

        accessories:
          'Carry an umbrella.'
      }
    }
  };
}

test(
  'plain text email contains both periods',
  function () {
    var text =
      email.buildTextReport(
        sampleWeather(),
        sampleAdvice()
      );

    assert.ok(
      text.indexOf(
        'MORNING'
      ) !== -1
    );

    assert.ok(
      text.indexOf(
        'NIGHT'
      ) !== -1
    );
  }
);

test(
  'HTML email contains report table',
  function () {
    var html =
      email.buildHtmlReport(
        sampleWeather(),
        sampleAdvice()
      );

    assert.ok(
      html.indexOf(
        '<table'
      ) !== -1
    );

    assert.ok(
      html.indexOf(
        'Suggested dressing'
      ) !== -1
    );
  }
);

test(
  'HTML email escapes hostile advice',
  function () {
    var advice =
      sampleAdvice();

    advice.advice
      .morning
      .dressing =
      '<script>alert(1)</script>';

    var html =
      email.buildHtmlReport(
        sampleWeather(),
        advice
      );

    assert.strictEqual(
      html.indexOf(
        '<script>'
      ),
      -1
    );

    assert.ok(
      html.indexOf(
        '&lt;script&gt;'
      ) !== -1
    );
  }
);

test(
  'email goes only to requested recipient',
  function () {
    var command =
      email.buildSendCommand(
        'first@example.com',
        sampleWeather(),
        sampleAdvice()
      );

    assert.deepStrictEqual(
      command
        .Destination
        .ToAddresses,
      [
        'first@example.com'
      ]
    );
  }
);

test(
  'different recipients produce isolated destinations',
  function () {
    var first =
      email.buildSendCommand(
        'first@example.com',
        sampleWeather(),
        sampleAdvice()
      );

    var second =
      email.buildSendCommand(
        'second@example.com',
        sampleWeather(),
        sampleAdvice()
      );

    assert.deepStrictEqual(
      first
        .Destination
        .ToAddresses,
      [
        'first@example.com'
      ]
    );

    assert.deepStrictEqual(
      second
        .Destination
        .ToAddresses,
      [
        'second@example.com'
      ]
    );

    assert.strictEqual(
      first
        .Destination
        .ToAddresses
        .indexOf(
          'second@example.com'
        ),
      -1
    );

    assert.strictEqual(
      second
        .Destination
        .ToAddresses
        .indexOf(
          'first@example.com'
        ),
      -1
    );
  }
);

test(
  'email body does not automatically include recipient address',
  function () {
    var command =
      email.buildSendCommand(
        'private@example.com',
        sampleWeather(),
        sampleAdvice()
      );

    var body =
      command
        .Content
        .Simple
        .Body
        .Text
        .Data;

    assert.strictEqual(
      body.indexOf(
        'private@example.com'
      ),
      -1
    );
  }
);
