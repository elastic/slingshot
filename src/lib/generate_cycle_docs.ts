import { Moment } from 'moment';
import { setWith, isFunction, isString } from 'lodash';
import Mustache from 'mustache';
import { Logger } from 'winston';
import dot from 'dot-object';
import { TypeGenerator } from '../types';

export function generateCycleDocs(
  time: Moment,
  logger: Logger,
  { docsPerCycle, template, createCycleValues }: TypeGenerator
): any[] {
  const docs: any[] = [];
  for (let i = 0; i < docsPerCycle; i++) {
    const templates = Array.isArray(template) ? template : [template];
    const cycleValues = createCycleValues(i, time);
    templates.forEach(eventTemplate => {
      const keys = Object.keys(eventTemplate);

      const doc = keys.reduce((acc, path) => {
        const eventTemplateValue = eventTemplate[path];
        const value = isString(eventTemplateValue)
          ? Mustache.render(eventTemplateValue, cycleValues)
          : isFunction(eventTemplateValue)
            ? eventTemplateValue(cycleValues)
            : eventTemplateValue;
        setWith(acc, path, value, Object);
        return acc;
      }, {});

      logger.debug(JSON.stringify(doc, null, 2));
      docs.push(dot.object(doc));
    });
  }
  return docs;
}
