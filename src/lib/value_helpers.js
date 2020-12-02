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

module.exports = { randomInt, guardValue, chooseRandomItem };
