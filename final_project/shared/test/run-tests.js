'use strict';

var fs = require('fs');
var path = require('path');

var files =
  fs.readdirSync(__dirname)
    .filter(function (file) {
      return file.endsWith(
        '.test.js'
      );
    })
    .sort();

var passed = 0;
var failed = 0;

global.test =
  function (name, fn) {
    try {
      fn();

      passed += 1;

      console.log(
        'PASS:',
        name
      );
    } catch (err) {
      failed += 1;

      console.log(
        'FAIL:',
        name
      );

      console.log(
        '  ' +
        err.message
      );
    }
  };

files.forEach(
  function (file) {
    require(
      path.join(
        __dirname,
        file
      )
    );
  }
);

console.log('');
console.log(
  'Passed:',
  passed
);
console.log(
  'Failed:',
  failed
);

if (failed > 0) {
  process.exit(1);
}
