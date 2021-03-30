import randomDistribution from 'random';
import { includes, random } from 'lodash';
import moment from 'moment';
import { TypeDef } from '../types';

export function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1) + min);
}

export function guardValue(value: number, { min = 0, max = 1 }) {
  if (min > max) {
    throw new Error(`Invalid guard min: ${min} and max: ${max}`);
  }
  return Math.max(Math.min(value, max), min);
}

export function chooseRandomItem<T>(list: T[]): T {
  const randomIndex = randomInt(0, list.length - 1);
  return list[randomIndex];
}

interface Guard {
  min: number;
  max: number;
}

export function getMetric(
  time: moment.Moment,
  name: string,
  typeDef: TypeDef,
  guard: Guard
) {
  const normal =
    typeDef.normal && typeDef.normal.find(def => def.name === name);
  if (!normal) return 0;

  const spike = typeDef.spike && typeDef.spike.find(def => def.name === name);

  if (spike) {
    const hours = spike.hours ? spike.hours : [random(0, 23)];
    const minutes = spike.minutes ? spike.minutes : [random(0, 59)];
    const inSpike =
      includes(hours, time.hour()) && includes(minutes, time.minute());
    if (inSpike) {
      const rand = randomDistribution.normal(spike.mean, spike.stdev);
      return guardValue(rand(), guard);
    }
  }
  const rand = randomDistribution.normal(normal.mean, normal.stdev);
  return guardValue(rand(), guard);
}
