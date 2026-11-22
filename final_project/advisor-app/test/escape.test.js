'use strict';

var assert = require('assert');
var escape = require('../lib/escape');

test('HTML special characters are escaped', function () {
  assert.strictEqual(
    escape.escapeHtml('<b>"test" & \'x\'</b>'),
    '&lt;b&gt;&quot;test&quot; &amp; &#39;x&#39;&lt;/b&gt;'
  );
});

test('null becomes empty string', function () {
  assert.strictEqual(
    escape.escapeHtml(null),
    ''
  );
});

test('plain text remains plain text', function () {
  assert.strictEqual(
    escape.escapeHtml('Chicago weather'),
    'Chicago weather'
  );
});
