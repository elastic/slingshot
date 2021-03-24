const random = require('random');
const { includes }  = require('lodash');

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1) + min);
}

function guardValue(value, { min = 0, max = 1 }) {
  if (min > max) {
    throw new Error(`Invalid guard min: ${min} and max: ${max}`);
  }
  return Math.max(Math.min(value, max), min);
}

function chooseRandomItem(list) {
  const random_index = randomInt(0, list.length - 1);
  return list[random_index];
}

function getMetric(time, metric, spike, guard) {
  if (spike) {
    const hours = typeof spike.hours === 'function' ? spike.hours(time.clone()) : spike.hours;
    const minutes = typeof spike.minutes === 'function' ? spike.minutes(time.clone()) : spike.minutes;
    const inSpike = includes(hours, time.hour()) && includes(minutes, time.minute());
    if (inSpike) {
      const rand = random.normal(spike.mean, spike.stdev);
      return guardValue(rand(), guard);
    }
  }
  const rand = random.normal(metric.mean, metric.stdev);
  return guardValue(rand(), guard);
}

module.exports = { randomInt, guardValue, chooseRandomItem, getMetric };
