'use strict';

var assert = require('assert');
var gemini = require('../lib/gemini');

function goodPeriod() {
  return {
    road_conditions:
      'Roads should remain mostly dry.',
    dressing:
      'A light jacket should be sufficient.',
    accessories:
      'Sunglasses may be useful.'
  };
}

function goodAdvice() {
  return {
    morning: goodPeriod(),
    night: goodPeriod()
  };
}

test(
  'valid Morning/Night Gemini response is accepted',
  function () {
    assert.strictEqual(
      gemini.validateGeminiAdvice(
        goodAdvice()
      ).ok,
      true
    );
  }
);

test(
  'non-object Gemini response is rejected',
  function () {
    assert.strictEqual(
      gemini.validateGeminiAdvice(
        'bad'
      ).ok,
      false
    );
  }
);

test(
  'missing morning is rejected',
  function () {
    var value = goodAdvice();
    delete value.morning;

    assert.strictEqual(
      gemini.validateGeminiAdvice(
        value
      ).ok,
      false
    );
  }
);

test(
  'missing night is rejected',
  function () {
    var value = goodAdvice();
    delete value.night;

    assert.strictEqual(
      gemini.validateGeminiAdvice(
        value
      ).ok,
      false
    );
  }
);

test(
  'unexpected top-level field is rejected',
  function () {
    var value = goodAdvice();
    value.extra = {};

    assert.strictEqual(
      gemini.validateGeminiAdvice(
        value
      ).ok,
      false
    );
  }
);

test(
  'missing period field is rejected',
  function () {
    var value = goodAdvice();
    delete value.morning.accessories;

    assert.strictEqual(
      gemini.validateGeminiAdvice(
        value
      ).ok,
      false
    );
  }
);

test(
  'HTML in Gemini output is rejected',
  function () {
    var value = goodAdvice();

    value.morning.dressing =
      '<script>alert(1)</script>';

    assert.strictEqual(
      gemini.validateGeminiAdvice(
        value
      ).ok,
      false
    );
  }
);

test(
  'empty Gemini field is rejected',
  function () {
    var value = goodAdvice();

    value.night.accessories = '';

    assert.strictEqual(
      gemini.validateGeminiAdvice(
        value
      ).ok,
      false
    );
  }
);

test(
  'overly long Gemini field is rejected',
  function () {
    var value = goodAdvice();

    value.morning.road_conditions =
      new Array(502).join('x');

    assert.strictEqual(
      gemini.validateGeminiAdvice(
        value
      ).ok,
      false
    );
  }
);
