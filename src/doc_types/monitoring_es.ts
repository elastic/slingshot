import faker from 'faker';
import { Moment } from 'moment';
import { SlingshotContext, TypeDef, TypeGenerator } from '../types';

export interface CycleValues {
  date: string;
}

export function initializeMonitoringEs(
  typeDef: TypeDef,
  { logger }: SlingshotContext
): TypeGenerator {
  const clusterUuid = faker.datatype.uuid();
  return {
    index: '.monitoring-es-7-slingshot',
    docsPerCycle: typeDef.total,
    createCycleValues: (i: number, now: Moment): CycleValues => {
      logger.verbose(`check ${now.valueOf()}`);
      logger.verbose(`Creating cycle values for ${now.toISOString()}`);
      return {
        date: now.toISOString(),
      };
    },
    template: [
      {
        timestamp: '{{date}}',
        type: 'cluster_stats',
        cluster_uuid: clusterUuid,
        'license.status': 'active',
      },
    ],
  };
}
