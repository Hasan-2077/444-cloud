'use strict';

function fallbackAdvice(facts, clothingCategory) {
  var temperatureLow =
    facts &&
    facts.temperature &&
    facts.temperature.min;

  var rain = facts ? facts.rain : null;
  var snow = facts ? facts.snow : null;
  var visibilityMiles =
    facts ? facts.visibilityMiles : null;
  var uv = facts ? facts.uv : null;
  var windMph = facts ? facts.windMph : null;

  var road = [];

  if (rain === 'Heavy') {
    road.push('Expect wet roads and reduced traction.');
  }

  if (snow === 'Heavy') {
    road.push(
      'Expect significant snow accumulation and hazardous roads.'
    );
  }

  if (
    typeof visibilityMiles === 'number' &&
    visibilityMiles < 3
  ) {
    road.push(
      'Reduced visibility may make driving more difficult.'
    );
  }

  if (
    typeof windMph === 'number' &&
    windMph >= 25
  ) {
    road.push(
      'Use caution for strong winds and possible crosswinds.'
    );
  }

  if (road.length === 0) {
    road.push(
      'No major weather-related road concerns are indicated.'
    );
  }

  var clothing = [];

  if (
    typeof temperatureLow === 'number' &&
    temperatureLow <= 32
  ) {
    clothing.push(
      'Wear warm layers and an insulated outer layer.'
    );
  } else if (
    typeof temperatureLow === 'number' &&
    temperatureLow <= 50
  ) {
    clothing.push(
      'Wear a jacket or layered clothing.'
    );
  } else {
    clothing.push(
      'Wear clothing appropriate for mild conditions.'
    );
  }

  if (
    rain !== 'No' &&
    rain !== 'Not Available' &&
    rain !== null
  ) {
    clothing.push(
      'Choose water-resistant outerwear.'
    );
  }

  if (
    snow !== 'No' &&
    snow !== 'Not Available' &&
    snow !== null
  ) {
    clothing.push(
      'Wear warm footwear with good traction.'
    );
  }

  var accessories = [];

  if (
    rain !== 'No' &&
    rain !== 'Not Available' &&
    rain !== null
  ) {
    accessories.push('umbrella');
  }

  if (
    typeof uv === 'number' &&
    uv >= 3
  ) {
    accessories.push('sunscreen');
    accessories.push('sunglasses');
  }

  if (
    typeof temperatureLow === 'number' &&
    temperatureLow <= 32
  ) {
    accessories.push('gloves');
    accessories.push('scarf');
  }

  var uniqueAccessories = accessories.filter(
    function (item, index, list) {
      return list.indexOf(item) === index;
    }
  );

  return {
    road_conditions: road.join(' '),

    dressing:
      clothing.join(' ') +
      ' Clothing category: ' +
      clothingCategory +
      '.',

    accessories:
      uniqueAccessories.length > 0
        ? 'Consider carrying: ' +
          uniqueAccessories.join(', ') +
          '.'
        : 'No additional weather-specific accessories are necessary.'
  };
}

module.exports = {
  fallbackAdvice: fallbackAdvice
};
