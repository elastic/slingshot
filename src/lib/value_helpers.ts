import randomDistribution from 'random';
import { includes, random } from 'lodash';
import moment, { Moment } from 'moment';
import { TypeDef } from '../types';

const DURATION_REGEX = /(\d+)(s|m|h|d)/;

interface DurationCacheObject {
  start: number;
  end: number;
}

const durationCache = new Map<string, DurationCacheObject>();

const getDurationSpike = (name: string, duration: string, time: Moment) => {
  const parts = duration.match(DURATION_REGEX);
  if (parts) {
    const value = parseInt(parts[1], 10);
    const unit = parts[2] as 's' | 'm' | 'h' | 'd';
    const key = `${name}:${duration}:${time.dayOfYear()}`;
    if (!durationCache.has(key)) {
      const start = time
        .clone()
        .startOf('day')
        .add(random(0, 23), 'hours');
      const end = start.clone().add(value, unit);
      durationCache.set(key, { start: start.valueOf(), end: end.valueOf() });
    }

    const spike = durationCache.get(key);
    if (spike) {
      if (
        moment(spike.start).isBefore(time) &&
        moment(spike.end).isAfter(time)
      ) {
        return { hours: [time.hour()], minutes: [time.minute()] };
      }
    }
    return { hours: [], minutes: [] };
  } else {
    throw new Error(`Unable to parse duration: ${duration}`);
  }
};

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
    const hours = spike.hours
      ? spike.hours
      : getDurationSpike(name, spike.duration || '1m', time).hours;
    const minutes = spike.minutes
      ? spike.minutes
      : getDurationSpike(name, spike.duration || '1m', time).minutes;
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
