'use strict';

var METERS_PER_MILE = 1609.344;

function metersToMiles(meters) {
  if (
    typeof meters !== 'number' ||
    !isFinite(meters)
  ) {
    return null;
  }

  return meters / METERS_PER_MILE;
}

module.exports = {
  METERS_PER_MILE: METERS_PER_MILE,
  metersToMiles: metersToMiles
};
