'use strict';

function numericValues(values) {
  return values.filter(function (value) {
    return typeof value === 'number' &&
      isFinite(value);
  });
}

function minMax(values) {
  var nums = numericValues(values);

  if (nums.length === 0) {
    return null;
  }

  return {
    min: Math.min.apply(null, nums),
    max: Math.max.apply(null, nums)
  };
}

function maximum(values) {
  var nums = numericValues(values);

  if (nums.length === 0) {
    return null;
  }

  return Math.max.apply(null, nums);
}

function minimum(values) {
  var nums = numericValues(values);

  if (nums.length === 0) {
    return null;
  }

  return Math.min.apply(null, nums);
}

function average(values) {
  var nums = numericValues(values);

  if (nums.length === 0) {
    return null;
  }

  var total = nums.reduce(function (sum, value) {
    return sum + value;
  }, 0);

  return total / nums.length;
}

function sum(values) {
  var nums = numericValues(values);

  if (nums.length === 0) {
    return null;
  }

  return nums.reduce(function (total, value) {
    return total + value;
  }, 0);
}

module.exports = {
  numericValues: numericValues,
  minMax: minMax,
  maximum: maximum,
  minimum: minimum,
  average: average,
  sum: sum
};
