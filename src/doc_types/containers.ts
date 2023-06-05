import { get, random, times, sample, cloneDeep } from 'lodash';
import { Moment } from 'moment';
import { SlingshotContext, TypeDef } from '../types';
import { FAKE_IDENTIFIER, CLOUD_PROVIDERS, CLOUD_REGIONS } from '../constants';

const containerCache = new Map<number, ContainerDef>();

interface ContainerDef {
  id: string;
  provider: string;
  region: string;
  hostname: string;
  podname: string;
}

export interface CycleValues {
  date: string;
  container: ContainerDef;
  cloudProvider: string;
  cloudRegion: string;
  cloudInstanceId: string;
}

export function initializeContainers(typeDef: TypeDef, { logger }: SlingshotContext) {
  times(typeDef.total).forEach((i) => {
    if (containerCache.has(i)) {
      return containerCache.get(i);
    }

    const totalParent = get(typeDef, 'parent.total', 1);
    const parentIndex = totalParent > 1 ? random(0, totalParent - 1) : 0;
    const parentType = get(typeDef, 'parent.type', 'pods');
    const parentId = `${parentType === 'pods' ? 'pod' : 'host'}-${
      parentIndex + get(typeDef, 'parent.offsetBy', 0)
    }`;

    containerCache.set(i, {
      id: `container-${i}`,
      region: sample(typeDef.cloudRegions || CLOUD_REGIONS) || '',
      provider: sample(typeDef.cloudProviders || CLOUD_PROVIDERS) || '',
      hostname: parentType === 'hosts' ? parentId : '',
      podname: parentType === 'pods' ? parentId : '',
    });
  });

  const metricsetPeriod = 10000;

  return {
    index: 'metrics-kubernetes.container-slingshot',
    docsPerCycle: typeDef.total,
    createCycleValues: (i: number, now: Moment): CycleValues => {
      logger.verbose(`check ${now.valueOf()}`);
      logger.verbose(`Creating cycle values for ${now.toISOString()}`);

      const container = containerCache.get(i);

      if (!container) {
        throw new Error(`Could not find container-${i} in the initial cache`);
      }

      return {
        date: now.toISOString(),
        container: cloneDeep(container),
        cloudProvider: typeDef.addCloudData ? container.provider : '',
        cloudInstanceId: typeDef.addCloudData ? container.id : '',
        cloudRegion: typeDef.addCloudData ? container.region : '',
      };
    },
    template: [
      {
        '@timestamp': '{{date}}',
        'agent.ephemeral_id': `{{container.hostname}}-ephemeral-uuid_${FAKE_IDENTIFIER}`,
        'agent.hostname': `{{container.hostname}}-agent-hostname_${FAKE_IDENTIFIER}`,
        'agent.id': `{{container.hostname}}-agent-uuid_${FAKE_IDENTIFIER}`,
        'agent.name': `{{container.hostname}}-agent-name_${FAKE_IDENTIFIER}`,
        'agent.type': 'slingshot-metricbeat',
        'agent.version': '7.9.3',
        'cloud.instance.id': '{{cloudInstanceId}}',
        'cloud.provider': '{{cloudProvider}}',
        'cloud.region': '{{cloudRegion}}',
        'container.id': '{{container.id}}',
        'container.name': '{{container.id}}',
        'data_stream.dataset': 'kubernetes.container',
        'host.name': '{{container.hostname}}',
        'host.hostname': '{{container.hostname}}',
        'kubernetes.node.name': '{{container.hostname}}',
        'kubernetes.node.uid': '{{container.hostname}}',
        'kubernetes.pod.name': '{{container.podname}}',
        'kubernetes.pod.uid': '{{container.podname}}',
        'metricset.name': 'container',
        'metricset.period': metricsetPeriod,
        'service.type': 'slingshot-container',
      },
    ],
  };
}
