import faker from 'faker';
import { times, sample, cloneDeep } from 'lodash';
import moment, { Moment } from 'moment';
import { randomInt, getMetric } from '../lib/value_helpers';
import { SlingshotContext, TypeDef } from '../types';
import {
  FAKE_IDENTIFIER,
  PLATFORMS,
  CLOUD_PROVIDERS,
  CLOUD_REGIONS
} from '../constants';

const TRANSFER_CACHE: Record<string, number> = {};
const HOST_CACHE: Record<string, HostDef> = {};

interface HostDef {
  id: string;
  name: string;
  ip: string[];
  mac: string[];
  platform: string;
  provider: string;
  region: string;
  totalMemory: number;
  cores: number;
  createdAt: Moment;
}

export interface CycleValues {
  date: string;
  host: HostDef;
  cloudProvider: string;
  cloudRegion: string;
  cloudInstanceId: string;
  eventDuration: number;
  cpuPct: number;
  memoryPct: number;
  loadValue: number;
  rxValue: number;
  txValue: number;
  rxTotal: number;
  txTotal: number;
  uptime: number;
}

export function initializeHosts(
  typeDef: TypeDef,
  { logger }: SlingshotContext
) {
  times(typeDef.total).forEach(i => {
    if (HOST_CACHE[i]) {
      return HOST_CACHE[i];
    }
    HOST_CACHE[i] = {
      name: `host-${i + (typeDef.offsetBy || 0)}`,
      ip: [faker.internet.ip()],
      id: faker.random.uuid(),
      mac: [faker.internet.mac()],
      platform: sample(typeDef.platforms || PLATFORMS) || '',
      totalMemory:
        sample(
          [
            Math.pow(1024, 2) * 4,
            Math.pow(1024, 2) * 8,
            Math.pow(1024, 2) * 16,
            Math.pow(1024, 2) * 32,
            Math.pow(1024, 2) * 64
          ]
        ) || Math.pow(1024, 2) * 4,
      provider: sample(typeDef.cloudProviders || CLOUD_PROVIDERS) || '',
      region: sample(typeDef.cloudRegions || CLOUD_REGIONS) || '',
      cores: randomInt(1, 8),
      createdAt: moment()
    };
  });

  const metricsetPeriod = 10000;

  return {
    index: 'metrics-system-slingshot',
    docsPerCycle: typeDef.total,
    createCycleValues: (i: number, now: Moment): CycleValues => {
      logger.verbose(`check ${now.valueOf()}`);
      logger.verbose(`Creating cycle values for ${now.toISOString()}`);

      const host = HOST_CACHE[i];

      const cpuPct = getMetric(now, 'cpu', typeDef, { min: 0, max: 0 });
      const memoryPct = getMetric(now, 'memory', typeDef, { min: 0, max: 0 });
      const loadValue = getMetric(now, 'load', typeDef, {
        min: 0,
        max: host.cores
      });
      const rxValue = getMetric(now, 'rx', typeDef, {
        min: 0,
        max: Number.MAX_SAFE_INTEGER
      });
      const txValue = getMetric(now, 'tx', typeDef, {
        min: 0,
        max: Number.MAX_SAFE_INTEGER
      });

      const shouldRXReset =
        TRANSFER_CACHE[`${host.name}-rx`] &&
        TRANSFER_CACHE[`${host.name}-rx`] + rxValue < Number.MAX_SAFE_INTEGER;
      const shouldTXReset =
        TRANSFER_CACHE[`${host.name}-tx`] &&
        TRANSFER_CACHE[`${host.name}-tx`] + txValue < Number.MAX_SAFE_INTEGER;
      TRANSFER_CACHE[`${host.name}-rx`] = shouldRXReset
        ? TRANSFER_CACHE[`${host.name}-rx`] + rxValue
        : rxValue;
      TRANSFER_CACHE[`${host.name}-tx`] = shouldTXReset
        ? TRANSFER_CACHE[`${host.name}-tx`] + txValue
        : txValue;

      return {
        date: now.toISOString(),
        host: cloneDeep(host),
        cloudProvider: typeDef.addCloudData ? host.provider : '',
        cloudInstanceId: typeDef.addCloudData ? host.id : '',
        cloudRegion: typeDef.addCloudData ? host.region : '',
        eventDuration: randomInt(80000000, 85000000), // TODO: is this the right range? does it matter?
        cpuPct,
        memoryPct,
        loadValue,
        rxValue,
        txValue,
        rxTotal: TRANSFER_CACHE[`${host.name}-rx`],
        txTotal: TRANSFER_CACHE[`${host.name}-tx`],
        uptime: moment().valueOf() - host.createdAt.valueOf()
      };
    },
    template: [
      {
        '@timestamp': '{{date}}',
        'host.name': ({ host }: CycleValues) => host.name,
        'host.hostname': ({ host }: CycleValues) => host.name,
        'host.ip': ({ host }: CycleValues) => host.ip,
        'host.id': ({ host }: CycleValues) => host.id,
        'host.mac': ({ host }: CycleValues) => host.mac,
        'host.architecture': 'X86_64',
        'host.os.platform': ({ host }: CycleValues) => host.platform,
        'agent.ephemeral_id': `{{host.name}}-ephemeral-uuid_${FAKE_IDENTIFIER}`,
        'agent.hostname': `{{host.name}}-agent-hostname_${FAKE_IDENTIFIER}`,
        'agent.id': `{{host.name}}-agent-uuid_${FAKE_IDENTIFIER}`,
        'agent.name': `{{host.name}}-agent-name_${FAKE_IDENTIFIER}`,
        'agent.type': 'slingshot-metricbeat',
        'agent.version': '7.9.3',
        'ecs.version': '1.7.0',
        'event.dataset': 'system.cpu',
        'event.duration': '{{event_duration}}',
        'event.module': 'system',
        'cloud.instance.id': '{{cloud_instance_id}}',
        'cloud.provider': '{{cloud_provider}}',
        'cloud.region': '{{cloud_region}}',
        'metricset.name': 'cpu',
        'metricset.period': metricsetPeriod,
        'service.type': 'slingshot-host',
        'host.cpu.pct': ({ cpuPct }: CycleValues) => cpuPct,
        'system.cpu.cores': ({ host }: CycleValues) => host.cores,
        'system.cpu.idle.norm.pct': ({ cpuPct }: CycleValues) => cpuPct,
        'system.cpu.idle.pct': ({ cpuPct, host }: CycleValues) =>
          cpuPct * host.cores,
        'system.cpu.nice.norm.pct': 0,
        'system.cpu.nice.pct': 0,
        'system.cpu.system.norm.pct': ({ cpuPct }: CycleValues) => cpuPct * 0.2,
        'system.cpu.system.pct': ({ cpuPct, loadValue }: CycleValues) =>
          cpuPct * 0.2 * loadValue,
        'system.cpu.total.norm.pct': ({ cpuPct, loadValue }: CycleValues) =>
          cpuPct * loadValue,
        'system.cpu.total.pct': ({ cpuPct, loadValue }: CycleValues) =>
          cpuPct * loadValue,
        'system.cpu.user.norm.pct': ({ cpuPct, loadValue }: CycleValues) =>
          cpuPct * 0.8 * loadValue,
        'system.cpu.user.pct': ({ cpuPct, loadValue }: CycleValues) =>
          cpuPct * 0.8 * loadValue
      },
      {
        '@timestamp': '{{date}}',
        'host.name': ({ host }: CycleValues) => host.name,
        'host.hostname': ({ host }: CycleValues) => host.name,
        'host.ip': ({ host }: CycleValues) => host.ip,
        'host.id': ({ host }: CycleValues) => host.id,
        'host.mac': ({ host }: CycleValues) => host.mac,
        'host.architecture': 'X86_64',
        'host.os.platform': ({ host }: CycleValues) => host.platform,
        'agent.ephemeral_id': `{{host.name}}-ephemeral-uuid_${FAKE_IDENTIFIER}`,
        'agent.hostname': `{{host.name}}-agent-hostname_${FAKE_IDENTIFIER}`,
        'agent.id': `{{host.name}}-agent-uuid_${FAKE_IDENTIFIER}`,
        'agent.name': `{{host.name}}-agent-name_${FAKE_IDENTIFIER}`,
        'agent.type': 'slingshot-metricbeat',
        'agent.version': '7.9.3',
        'ecs.version': '1.7.0',
        'event.dataset': 'system.memory',
        'event.duration': '{{event_duration}}',
        'event.module': 'system',
        'cloud.instance.id': '{{cloud_instance_id}}',
        'cloud.provider': '{{cloud_provider}}',
        'cloud.region': '{{cloud_region}}',
        'metricset.name': 'memory',
        'metricset.period': metricsetPeriod,
        'service.type': 'slingshot-host',
        'system.memory.actual.free': ({ host, memoryPct }: CycleValues) =>
          Math.floor((1 - memoryPct) * host.totalMemory * 0.9),
        'system.memory.actual.used.bytes': ({ host, memoryPct }: CycleValues) =>
          Math.floor(memoryPct * host.totalMemory * 0.9),
        'system.memory.actual.used.pct': ({ memoryPct }: CycleValues) =>
          memoryPct * 0.9,
        'system.memory.total': ({ host }: CycleValues) => host.totalMemory,
        'system.memory.swap.free': ({ host, memoryPct }: CycleValues) =>
          Math.floor((1 - memoryPct) * host.totalMemory * 0.2),
        'system.memory.swap.used.bytes': ({ host, memoryPct }: CycleValues) =>
          Math.floor(memoryPct * host.totalMemory * 0.2),
        'system.memory.swap.used.pct': ({ memoryPct }: CycleValues) =>
          memoryPct * 0.2,
        'system.memory.swap.total': ({ host }: CycleValues) =>
          Math.floor(host.totalMemory * 0.2),
        'system.memory.free': ({ host, memoryPct }: CycleValues) =>
          Math.floor((1 - memoryPct) * host.totalMemory),
        'system.memory.used.bytes': ({ host, memoryPct }: CycleValues) =>
          Math.floor(memoryPct * host.totalMemory),
        'system.memory.used.pct': ({ memoryPct }: CycleValues) => memoryPct
      },
      {
        '@timestamp': '{{date}}',
        'host.name': ({ host }: CycleValues) => host.name,
        'host.hostname': ({ host }: CycleValues) => host.name,
        'host.ip': ({ host }: CycleValues) => host.ip,
        'host.id': ({ host }: CycleValues) => host.id,
        'host.mac': ({ host }: CycleValues) => host.mac,
        'host.architecture': 'X86_64',
        'host.os.platform': ({ host }: CycleValues) => host.platform,
        'agent.ephemeral_id': `{{host.name}}-ephemeral-uuid_${FAKE_IDENTIFIER}`,
        'agent.hostname': `{{host.name}}-agent-hostname_${FAKE_IDENTIFIER}`,
        'agent.id': `{{host.name}}-agent-uuid_${FAKE_IDENTIFIER}`,
        'agent.name': `{{host.name}}-agent-name_${FAKE_IDENTIFIER}`,
        'agent.type': 'slingshot-metricbeat',
        'agent.version': '7.9.3',
        'ecs.version': '1.7.0',
        'event.dataset': 'system.load',
        'event.duration': '{{event_duration}}',
        'event.module': 'system',
        'cloud.instance.id': '{{cloud_instance_id}}',
        'cloud.provider': '{{cloud_provider}}',
        'cloud.region': '{{cloud_region}}',
        'metricset.name': 'load',
        'metricset.period': metricsetPeriod,
        'service.type': 'slingshot-host',
        'system.load.1': ({ host, loadValue }: CycleValues) =>
          loadValue * host.cores,
        'system.load.5': ({ host, loadValue }: CycleValues) =>
          loadValue * 0.85 * host.cores,
        'system.load.15': ({ host, loadValue }: CycleValues) =>
          loadValue * 0.75 * host.cores,
        'system.load.norm.1': ({ loadValue }: CycleValues) => loadValue,
        'system.load.norm.5': ({ loadValue }: CycleValues) => loadValue * 0.85,
        'system.load.norm.15': ({ loadValue }: CycleValues) => loadValue * 0.75
      },
      {
        '@timestamp': '{{date}}',
        'host.name': ({ host }: CycleValues) => host.name,
        'host.hostname': ({ host }: CycleValues) => host.name,
        'host.ip': ({ host }: CycleValues) => host.ip,
        'host.id': ({ host }: CycleValues) => host.id,
        'host.mac': ({ host }: CycleValues) => host.mac,
        'host.architecture': 'X86_64',
        'host.os.platform': ({ host }: CycleValues) => host.platform,
        'agent.ephemeral_id': `{{host.name}}-ephemeral-uuid_${FAKE_IDENTIFIER}`,
        'agent.hostname': `{{host.name}}-agent-hostname_${FAKE_IDENTIFIER}`,
        'agent.id': `{{host.name}}-agent-uuid_${FAKE_IDENTIFIER}`,
        'agent.name': `{{host.name}}-agent-name_${FAKE_IDENTIFIER}`,
        'agent.type': 'slingshot-metricbeat',
        'agent.version': '7.9.3',
        'ecs.version': '1.7.0',
        'event.dataset': 'system.network',
        'event.duration': '{{event_duration}}',
        'event.module': 'system',
        'cloud.instance.id': '{{cloud_instance_id}}',
        'cloud.provider': '{{cloud_provider}}',
        'cloud.region': '{{cloud_region}}',
        'metricset.name': 'network',
        'metricset.period': metricsetPeriod,
        'service.type': 'slingshot-host',
        'system.network.name': 'en0',
        'system.network.out.bytes': ({ txTotal }: CycleValues) => txTotal,
        'system.network.out.packets': ({ txTotal }: CycleValues) =>
          txTotal * 0.002,
        'system.network.out.errors': ({ txTotal }: CycleValues) =>
          txTotal * 0.0002,
        'system.network.out.dropped': ({ txTotal }: CycleValues) =>
          txTotal * 0.0001,
        'system.network.in.bytes': ({ rxTotal }: CycleValues) => rxTotal,
        'system.network.in.packets': ({ rxTotal }: CycleValues) =>
          rxTotal * 0.002,
        'system.network.in.errors': 0,
        'system.network.in.dropped': 0,
        'host.network.ingress.bytes': ({ rxValue }: CycleValues) => rxValue,
        'host.network.egress.bytes': ({ txValue }: CycleValues) => txValue,
        'host.network.in.bytes': ({ rxValue }: CycleValues) => rxValue,
        'host.network.out.bytes': ({ txValue }: CycleValues) => txValue
      },
      {
        '@timestamp': '{{date}}',
        'host.name': ({ host }: CycleValues) => host.name,
        'host.hostname': ({ host }: CycleValues) => host.name,
        'host.ip': ({ host }: CycleValues) => host.ip,
        'host.id': ({ host }: CycleValues) => host.id,
        'host.mac': ({ host }: CycleValues) => host.mac,
        'host.architecture': 'X86_64',
        'host.os.platform': ({ host }: CycleValues) => host.platform,
        'agent.ephemeral_id': `{{host.name}}-ephemeral-uuid_${FAKE_IDENTIFIER}`,
        'agent.hostname': `{{host.name}}-agent-hostname_${FAKE_IDENTIFIER}`,
        'agent.id': `{{host.name}}-agent-uuid_${FAKE_IDENTIFIER}`,
        'agent.name': `{{host.name}}-agent-name_${FAKE_IDENTIFIER}`,
        'agent.type': 'slingshot-metricbeat',
        'agent.version': '7.9.3',
        'ecs.version': '1.7.0',
        'event.dataset': 'system.uptime',
        'event.duration': '{{event_duration}}',
        'event.module': 'system',
        'cloud.instance.id': '{{cloud_instance_id}}',
        'cloud.provider': '{{cloud_provider}}',
        'cloud.region': '{{cloud_region}}',
        'metricset.name': 'uptime',
        'metricset.period': metricsetPeriod,
        'service.type': 'slingshot-host',
        'system.uptime.duration.ms': ({ uptime }: CycleValues) => uptime
      }
    ]
  };
}
