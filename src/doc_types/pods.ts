import { random, get, times, sample, cloneDeep } from 'lodash';
import faker from 'faker';
import moment, { Moment } from 'moment';
import { getMetric } from '../lib/value_helpers';
import { SlingshotContext, TypeDef } from '../types';
import {
  FAKE_IDENTIFIER,
  PLATFORMS,
  CLOUD_PROVIDERS,
  CLOUD_REGIONS,
  NAMESPACES,
} from '../constants';
import { getTotalTransferFor } from '../lib/transfer_cache';

interface PodDef {
  id: string;
  name: string;
  hostname: string;
  namespace: string;
  ip: string[];
  platform: string;
  provider: string;
  region: string;
  createdAt: Moment;
}

export interface CycleValues {
  date: string;
  pod: PodDef;
  cloudProvider: string;
  cloudRegion: string;
  cloudInstanceId: string;
  eventDuration: number;
  cpuPct: number;
  memoryPct: number;
  rxValue: number;
  txValue: number;
  rxTotal: number;
  txTotal: number;
}

const POD_CACHE: Record<string, PodDef> = {};

export function intializePods(typeDef: TypeDef, { logger }: SlingshotContext) {
  // Create the pods so they are stable across calls
  times(typeDef.total).forEach(i => {
    if (POD_CACHE[i]) {
      return POD_CACHE[i];
    }
    const totalHosts = get(typeDef, 'parent.total', 1);
    const hostIndex = totalHosts > 1 ? random(0, totalHosts - 1) : 0;
    const hostname = `host-${hostIndex + get(typeDef, 'parent.offsetBy', 0)}`;
    POD_CACHE[i] = {
      name: `pod-${i + (typeDef.offsetBy || 0)}`,
      hostname,
      ip: [faker.internet.ip()],
      id: faker.datatype.uuid(),
      platform: sample(typeDef.platforms || PLATFORMS) || '',
      provider: sample(typeDef.cloudProviders || CLOUD_PROVIDERS) || '',
      region: sample(typeDef.cloudRegions || CLOUD_REGIONS) || '',
      namespace: sample(NAMESPACES) || '',
      createdAt: moment(),
    };
  });

  return {
    index: 'metrics-kubernetes.pod-slingshot',
    docsPerCycle: typeDef.total,
    createCycleValues: (i: number, now: Moment): CycleValues => {
      logger.verbose(`check ${now}`);
      logger.verbose(`Creating cycle values for ${now.toISOString()}`);

      const pod = POD_CACHE[i];
      const rxValue = getMetric(now, 'rx', typeDef, {
        min: 0,
        max: Number.MAX_SAFE_INTEGER,
      });
      const txValue = getMetric(now, 'tx', typeDef, {
        min: 0,
        max: Number.MAX_SAFE_INTEGER,
      });

      return {
        date: now.toISOString(),
        pod: cloneDeep(pod),
        cloudProvider: typeDef.addCloudData ? pod.provider : '',
        cloudInstanceId: typeDef.addCloudData ? pod.id : '',
        cloudRegion: typeDef.addCloudData ? pod.region : '',
        eventDuration: random(80000000, 85000000),
        memoryPct: getMetric(now, 'memory', typeDef, { min: 0, max: 1 }),
        cpuPct: getMetric(now, 'cpu', typeDef, { min: 0, max: 1 }),
        rxValue,
        txValue,
        rxTotal: getTotalTransferFor(`${pod.id}:rx`, rxValue),
        txTotal: getTotalTransferFor(`${pod.id}:tx`, txValue),
      };
    },
    template: [
      {
        '@timestamp': '{{date}}',
        'agent.ephemeral_id': `{{pod.hostname}}-ephemeral-uuid_${FAKE_IDENTIFIER}`,
        'agent.hostname': `{{pod.hostname}}-agent-hostname_${FAKE_IDENTIFIER}`,
        'agent.id': `{{pod.hostname}}-agent-uuid_${FAKE_IDENTIFIER}`,
        'agent.name': `{{pod.hostname}}-agent-name_${FAKE_IDENTIFIER}`,
        'agent.type': 'slingshot-metricbeat',
        'agent.version': '7.9.3',
        'cloud.instance.id': '{{cloudInstanceId}}',
        'cloud.provider': '{{cloudProvider}}',
        'cloud.region': '{{cloudRegion}}',
        'ecs.version': '1.5.0',
        'event.dataset': 'kubernetes.pod',
        'event.duration': '{{eventDuration}}',
        'event.module': 'kubernetes',
        'host.name': '{{pod.hostname}}',
        'kubernetes.namespace': '{{pod.namespace}}',
        'kubernetes.node.name': `{{pod.hostname}}`,
        'kubernetes.pod.cpu.usage.node.pct': ({ cpuPct }: CycleValues) => cpuPct * 0.5,
        'kubernetes.pod.cpu.usage.limit.pct': ({ cpuPct }: CycleValues) => cpuPct,
        'kubernetes.pod.host_ip': '{{ip}}',
        'kubernetes.pod.ip': '{{ip}}',
        'kubernetes.pod.memory.usage.node.pct': ({ memoryPct }: CycleValues) => memoryPct * 0.5,
        'kubernetes.pod.memory.usage.limit.pct': ({ memoryPct }: CycleValues) => memoryPct,
        'kubernetes.pod.network.in.bytes': ({ rxTotal }: CycleValues) => rxTotal,
        'kubernetes.pod.network.in.errors': ({ rxTotal }: CycleValues) => rxTotal * 0.0002,
        'kubernetes.pod.network.out.bytes': ({ txTotal }: CycleValues) => txTotal,
        'kubernetes.pod.network.out.errors': ({ txTotal }: CycleValues) => txTotal * 0.0002,
        'kubernetes.pod.name': '{{pod.name}}',
        'kubernetes.pod.status.phase': 'running',
        'kubernetes.pod.status.ready': true,
        'kubernetes.pod.status.scheduled': true,
        'kubernetes.pod.uid': `{{pod.id}}`,
        'metricset.name': 'state_pod',
        'metricset.period': 10000,
        'service.address': `kube-state-metrics:8080_${FAKE_IDENTIFIER}`,
        'service.type': 'slingshot-kubernetes',
      },
    ],
  };
}
