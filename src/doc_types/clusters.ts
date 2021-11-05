import { Moment } from 'moment';
import { SlingshotContext, TypeDef, TypeGenerator } from '../types';

export interface CycleValues {
  date: string;
}

export function initializeClusters(typeDef: TypeDef, { logger }: SlingshotContext): TypeGenerator {
  return {
    index: '.monitoring-es-7-slingshot',
    docsPerCycle: typeDef.total,
    createCycleValues: (i: number, now: Moment): CycleValues => {
      return {
        date: now.toISOString(),
      };
    },
    template: [
      {
        '@timestamp': '{{date}}',
      },
    ],
  };
}
