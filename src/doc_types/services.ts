import { get, random, times, cloneDeep } from 'lodash';
import { Moment } from 'moment';
import { SlingshotContext, TypeDef } from '../types';

const serviceCache = new Map<number, ServiceDef>();

interface ServiceDef {
  name: string;
  containerid: string;
  hostname: string;
}

export interface CycleValues {
  date: string;
  service: ServiceDef;
}

export function initializeServices(typeDef: TypeDef, { logger }: SlingshotContext) {
  const environments = times(get(typeDef, 'environments', 1)).map((_, i) => `env-${i}`);

  times(typeDef.total).forEach((i) => {
    if (serviceCache.has(i)) {
      return serviceCache.get(i);
    }

    const totalParent = get(typeDef, 'parent.total', 1);
    const parentIndex = totalParent > 1 ? random(0, totalParent - 1) : 0;
    const parentType = get(typeDef, 'parent.type', 'containers');
    const parentId = `${parentType === 'containers' ? 'container' : 'host'}-${
      parentIndex + get(typeDef, 'parent.offsetBy', 0)
    }`;

    serviceCache.set(i, {
      name: `service-${i}`,
      containerid: parentType === 'containers' ? parentId : '',
      hostname: parentType === 'hosts' ? parentId : '',
    });
  });

  return {
    index: 'traces-apm-slingshot',
    docsPerCycle: typeDef.total,
    createCycleValues: (i: number, now: Moment): CycleValues => {
      logger.verbose(`check ${now.valueOf()}`);
      logger.verbose(`Creating cycle values for ${now.toISOString()}`);

      const service = serviceCache.get(i);

      if (!service) {
        throw new Error(`Could not find service-${i} in the initial cache`);
      }

      return {
        date: now.toISOString(),
        service: cloneDeep(service),
      };
    },
    template: environments.map((env) => ({
      '@timestamp': '{{date}}',
      'container.id': '{{service.containerid}}',
      'data_stream.dataset': 'apm',
      'host.name': '{{service.hostname}}',
      'host.hostname': '{{service.hostname}}',
      'observer.type': 'apm-server',
      'observer.version': '8.4.2',
      'service.environment': env,
      'service.name': '{{service.name}}',
    })),
  };
}
