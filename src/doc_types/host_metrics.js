const random = require('random');
const faker = require('faker');
const { get, times, sample, cloneDeep } = require('lodash');
const FAKE_IDENTIFIER = '_SS';
const {
  randomInt,
  getMetric,
} = require('../lib/value_helpers');
const moment = require('moment');

const TRANSFER_CACHE = {};
const HOST_CACHE = {};

const PLATFORMS = [
  'darwin',
  'linix',
  'windows',
  'aix',
  'freebsd',
  'andriod',
  'solaris',
  'illumos',
  'dragonfly',
  'andriod',
  'openbsd',
  'netbsd',
];

const CLOUD_PROVIDERS = [
  'aws',
  'gcp',
  'azure',
  '', // bare metal
];

const CLOUD_REGIONS = [
  'east-01',
  'east-02',
  'east-03',
  'west-01',
  'west-02',
  'midwest-01',
  'midwest-02',
]



module.exports = function loadHosts (options, { logger }) {
  const {
    n_hosts = 3, // how many hosts the pods will be spread across
    cloud = false, // whether these pods should be in the cloud (TODO: fix this)
    host_id_offset = 0, // use if you want to create different hosts than another run
    metrics = {},
    spike, // { memory: { hours: [1,2,3], minutes: [1,2,3], mean: 1, stdev: 0  } }
    cloudProviders = CLOUD_PROVIDERS,
    platforms = PLATFORMS,
    cloudRegions = CLOUD_REGIONS,
  } = options;

  times(n_hosts).forEach((i) => {
    if (HOST_CACHE[i]) {
      return HOST_CACHE[i];
    }
    HOST_CACHE[i] = {
      name: `host-${i + host_id_offset}`,
      ip: [faker.internet.ip()],
      id: faker.random.uuid(),
      mac: [faker.internet.mac()],
      platform: sample(platforms),
      totalMemory:  sample([(1024^2)*4, (1024^2)*8, (1024^2)*16, (1024^2)*32, , (1024^2)*64]),
      provider: sample(cloudProviders),
      region: sample(cloudRegions),
      cores: randomInt(1, 8),
      createdAt: moment(),
    }
  });

  const {
    memory = { mean: 0.6, stdev: 0.005 },
    cpu = { mean: 0.4, stdev: 0.1 },
    load = { mean: 1, stdev: 0.1 },
    rx = { mean: 1024^2, stdev:(1024^2)/2  },
    tx = { mean: 1024^2, stdev: (1024^2)/2 },
  } = metrics;

  const metricsetPeriod = 10000;

  return {
    // set our index for this type of document explicitly so the new index strategy will work
    index: 'metrics-system-slingshot',
    // n_docs_per_cycle tells the loader how many documents represent one 'cycle'
    n_docs_per_cycle: n_hosts,
    create_cycle_values: (i, now) => {
      logger.verbose(`check ${now.valueOf()}`);
      logger.verbose(
        `Creating cycle values for ${now.toISOString()}`
      );

      const host = HOST_CACHE[i];


      const cpuPct = getMetric(now, cpu, get(spike, 'cpu', null), { min: 0, max: 1 });
      const memoryPct = getMetric(now, memory, get(spike, 'memory', null), { min: 0, max: 1 });
      const loadValue = getMetric(now, load, get(spike, 'load', null), { min: 0, max: host.cores });
      const rxValue = getMetric(now, rx, get(spike, 'rx', null), { min: 0, max: Number.MAX_SAFE_INTEGER });
      const txValue = getMetric(now, tx, get(spike, 'tx', null), { min: 0, max: Number.MAX_SAFE_INTEGER });

      const shouldRXReset = TRANSFER_CACHE[`${host.name}-rx`] && TRANSFER_CACHE[`${host.name}-rx`] + rxValue < Number.MAX_SAFE_INTEGER;
      const shouldTXReset = TRANSFER_CACHE[`${host.name}-tx`] && TRANSFER_CACHE[`${host.name}-tx`] + txValue < Number.MAX_SAFE_INTEGER;
      TRANSFER_CACHE[`${host.name}-rx`] = shouldRXReset ?  TRANSFER_CACHE[`${host.name}-rx`] + rxValue : rxValue;
      TRANSFER_CACHE[`${host.name}-tx`] = shouldTXReset ?  TRANSFER_CACHE[`${host.name}-tx`] + txValue : txValue;

      return {
        date: now.toISOString(),
        host: cloneDeep(host),
        cloud_provider: cloud ? host.provider : '', // TODO: need to randomize this
        cloud_instance_id: cloud ? host.id : '',
        cloud_region: cloud ? host.region : '', // TODO: need to randomize this
        event_duration: randomInt(80000000, 85000000), // TODO: is this the right range? does it matter?
        values: {
          cpuPct,
          memoryPct,
          loadValue,
          rxValue,
          txValue,
          rxTotal: TRANSFER_CACHE[`${host.name}-rx`],
          txTotal: TRANSFER_CACHE[`${host.name}-tx`],
          uptime: moment().valueOf() - host.createdAt.valueOf(),
        }
      };
    },
    template: [
      {
        '@timestamp'                      : '{{date}}',
        'host.name'                       : ({ host }) => host.name,
        'host.hostname'                   : ({ host }) => host.name,
        'host.ip'                         : ({ host }) => host.ip,
        'host.id'                         : ({ host }) => host.id,
        'host.mac'                        : ({ host }) => host.mac,
        'host.architecture'               : 'X86_64',
        'host.os.platform'                : ({ host }) => host.platform,
        'agent.ephemeral_id'              : `{{host.name}}-ephemeral-uuid_${FAKE_IDENTIFIER}`,
        'agent.hostname'                  : `{{host.name}}-agent-hostname_${FAKE_IDENTIFIER}`,
        'agent.id'                        : `{{host.name}}-agent-uuid_${FAKE_IDENTIFIER}`,
        'agent.name'                      : `{{host.name}}-agent-name_${FAKE_IDENTIFIER}`,
        'agent.type'                      : 'slingshot-metricbeat',
        'agent.version'                   : '7.9.3',
        'ecs.version'                     : '1.7.0',
        'event.dataset'                   : 'system.cpu',
        'event.duration'                  : '{{event_duration}}',
        'event.module'                    : 'system',
        'cloud.instance.id'               : '{{cloud_instance_id}}',
        'cloud.provider'                  : '{{cloud_provider}}',
        'cloud.region'                    : '{{cloud_region}}',
        'metricset.name'                  : 'cpu',
        'metricset.period'                : metricsetPeriod,
        'service.type'                    : 'slingshot-host',
        'host.cpu.pct'                    : ({ values }) => values.cpuPct,
        'system.cpu.cores'                : ({ host }) => host.cores,
        'system.cpu.idle.norm.pct'        : ({ values }) => values.cpuPct,
        'system.cpu.idle.pct'             : ({ values, host }) => values.cpuPct * host.cores,
        'system.cpu.nice.norm.pct'        : 0,
        'system.cpu.nice.pct'             : 0,
        'system.cpu.system.norm.pct'      : ({ values }) => values.cpuPct * 0.2,
        'system.cpu.system.pct'           : ({ values }) => values.cpuPct * 0.2 * values.loadValue,
        'system.cpu.total.norm.pct'       : ({ values }) => values.cpuPct * values.loadValue,
        'system.cpu.total.pct'            : ({ values }) => values.cpuPct * values.loadValue,
        'system.cpu.user.norm.pct'        : ({ values }) => values.cpuPct * 0.8 * values.loadValue,
        'system.cpu.user.pct'             : ({ values }) => values.cpuPct * 0.8 * values.loadValue,
      },
      {
        '@timestamp'                      : '{{date}}',
        'host.name'                       : ({ host }) => host.name,
        'host.hostname'                   : ({ host }) => host.name,
        'host.ip'                         : ({ host }) => host.ip,
        'host.id'                         : ({ host }) => host.id,
        'host.mac'                        : ({ host }) => host.mac,
        'host.architecture'               : 'X86_64',
        'host.os.platform'                : ({ host }) => host.platform,
        'agent.ephemeral_id'              : `{{host.name}}-ephemeral-uuid_${FAKE_IDENTIFIER}`,
        'agent.hostname'                  : `{{host.name}}-agent-hostname_${FAKE_IDENTIFIER}`,
        'agent.id'                        : `{{host.name}}-agent-uuid_${FAKE_IDENTIFIER}`,
        'agent.name'                      : `{{host.name}}-agent-name_${FAKE_IDENTIFIER}`,
        'agent.type'                      : 'slingshot-metricbeat',
        'agent.version'                   : '7.9.3',
        'ecs.version'                     : '1.7.0',
        'event.dataset'                   : 'system.memory',
        'event.duration'                  : '{{event_duration}}',
        'event.module'                    : 'system',
        'cloud.instance.id'               : '{{cloud_instance_id}}',
        'cloud.provider'                  : '{{cloud_provider}}',
        'cloud.region'                    : '{{cloud_region}}',
        'metricset.name'                  : 'memory',
        'metricset.period'                : metricsetPeriod,
        'service.type'                    : 'slingshot-host',
        'system.memory.actual.free'       : ({ host, values }) => Math.floor((1 - values.memoryPct) * host.totalMemory * 0.9),
        'system.memory.actual.used.bytes' : ({ host, values }) => Math.floor(values.memoryPct * host.totalMemory * 0.9),
        'system.memory.actual.used.pct'   : ({ host, values }) => values.memoryPct * 0.9,
        'system.memory.total'             : ({ host }) => host.totalMemory,
        'system.memory.swap.free'       : ({ host, values }) => Math.floor((1 - values.memoryPct) * host.totalMemory * 0.2),
        'system.memory.swap.used.bytes' : ({ host, values }) => Math.floor(values.memoryPct * host.totalMemory * 0.2),
        'system.memory.swap.used.pct'   : ({ host, values }) => values.memoryPct * 0.2,
        'system.memory.swap.total'             : ({ host }) => Math.floor(host.totalMemory * 0.2),
        'system.memory.free'              : ({ host, values }) => Math.floor((1 - values.memoryPct) * host.totalMemory),
        'system.memory.used.bytes'        : ({ host, values }) => Math.floor(values.memoryPct * host.totalMemory),
        'system.memory.used.pct'          : ({ host, values }) => values.memoryPct,
      },
      {
        '@timestamp'                      : '{{date}}',
        'host.name'                       : ({ host }) => host.name,
        'host.hostname'                   : ({ host }) => host.name,
        'host.ip'                         : ({ host }) => host.ip,
        'host.id'                         : ({ host }) => host.id,
        'host.mac'                        : ({ host }) => host.mac,
        'host.architecture'               : 'X86_64',
        'host.os.platform'                : ({ host }) => host.platform,
        'agent.ephemeral_id'              : `{{host.name}}-ephemeral-uuid_${FAKE_IDENTIFIER}`,
        'agent.hostname'                  : `{{host.name}}-agent-hostname_${FAKE_IDENTIFIER}`,
        'agent.id'                        : `{{host.name}}-agent-uuid_${FAKE_IDENTIFIER}`,
        'agent.name'                      : `{{host.name}}-agent-name_${FAKE_IDENTIFIER}`,
        'agent.type'                      : 'slingshot-metricbeat',
        'agent.version'                   : '7.9.3',
        'ecs.version'                     : '1.7.0',
        'event.dataset'                   : 'system.load',
        'event.duration'                  : '{{event_duration}}',
        'event.module'                    : 'system',
        'cloud.instance.id'               : '{{cloud_instance_id}}',
        'cloud.provider'                  : '{{cloud_provider}}',
        'cloud.region'                    : '{{cloud_region}}',
        'metricset.name'                  : 'load',
        'metricset.period'                : metricsetPeriod,
        'service.type'                    : 'slingshot-host',
        'system.load.1'                   : ({ host, values }) => values.loadValue * host.cores,
        'system.load.5'                   : ({ host, values }) => values.loadValue * 0.85 * host.cores,
        'system.load.15'                  : ({ host, values }) => values.loadValue * 0.75 * host.cores,
        'system.load.norm.1'              : ({ values }) => values.loadValue,
        'system.load.norm.5'              : ({ values }) => values.loadValue * 0.85,
        'system.load.norm.15'             : ({ values }) => values.loadValue * 0.75,
      },
      {
        '@timestamp'                      : '{{date}}',
        'host.name'                       : ({ host }) => host.name,
        'host.hostname'                   : ({ host }) => host.name,
        'host.ip'                         : ({ host }) => host.ip,
        'host.id'                         : ({ host }) => host.id,
        'host.mac'                        : ({ host }) => host.mac,
        'host.architecture'               : 'X86_64',
        'host.os.platform'                : ({ host }) => host.platform,
        'agent.ephemeral_id'              : `{{host.name}}-ephemeral-uuid_${FAKE_IDENTIFIER}`,
        'agent.hostname'                  : `{{host.name}}-agent-hostname_${FAKE_IDENTIFIER}`,
        'agent.id'                        : `{{host.name}}-agent-uuid_${FAKE_IDENTIFIER}`,
        'agent.name'                      : `{{host.name}}-agent-name_${FAKE_IDENTIFIER}`,
        'agent.type'                      : 'slingshot-metricbeat',
        'agent.version'                   : '7.9.3',
        'ecs.version'                     : '1.7.0',
        'event.dataset'                   : 'system.network',
        'event.duration'                  : '{{event_duration}}',
        'event.module'                    : 'system',
        'cloud.instance.id'               : '{{cloud_instance_id}}',
        'cloud.provider'                  : '{{cloud_provider}}',
        'cloud.region'                    : '{{cloud_region}}',
        'metricset.name'                  : 'network',
        'metricset.period'                : metricsetPeriod,
        'service.type'                    : 'slingshot-host',
        'system.network.name'             : 'en0',
        'system.network.out.bytes'        : ({ values }) => values.txTotal,
        'system.network.out.packets'      : ({ values }) => values.txTotal * 0.002,
        'system.network.out.errors'       : ({ values }) => values.txTotal * 0.0002,
        'system.network.out.dropped'      : ({ values }) => values.txTotal * 0.0001,
        'system.network.in.bytes'         : ({ values }) => values.rxTotal,
        'system.network.in.packets'       : ({ values }) => values.rxTotal * 0.002,
        'system.network.in.errors'        : 0,
        'system.network.in.dropped'       : 0,
        'host.network.ingress.bytes'      : ({ values }) => values.rxValue,
        'host.network.egress.bytes'       : ({ values }) => values.txValue,
        'host.network.in.bytes'           : ({ values }) => values.rxValue,
        'host.network.out.bytes'          : ({ values }) => values.txValue,
      },
      {
        '@timestamp'                      : '{{date}}',
        'host.name'                       : ({ host }) => host.name,
        'host.hostname'                   : ({ host }) => host.name,
        'host.ip'                         : ({ host }) => host.ip,
        'host.id'                         : ({ host }) => host.id,
        'host.mac'                        : ({ host }) => host.mac,
        'host.architecture'               : 'X86_64',
        'host.os.platform'                : ({ host }) => host.platform,
        'agent.ephemeral_id'              : `{{host.name}}-ephemeral-uuid_${FAKE_IDENTIFIER}`,
        'agent.hostname'                  : `{{host.name}}-agent-hostname_${FAKE_IDENTIFIER}`,
        'agent.id'                        : `{{host.name}}-agent-uuid_${FAKE_IDENTIFIER}`,
        'agent.name'                      : `{{host.name}}-agent-name_${FAKE_IDENTIFIER}`,
        'agent.type'                      : 'slingshot-metricbeat',
        'agent.version'                   : '7.9.3',
        'ecs.version'                     : '1.7.0',
        'event.dataset'                   : 'system.uptime',
        'event.duration'                  : '{{event_duration}}',
        'event.module'                    : 'system',
        'cloud.instance.id'               : '{{cloud_instance_id}}',
        'cloud.provider'                  : '{{cloud_provider}}',
        'cloud.region'                    : '{{cloud_region}}',
        'metricset.name'                  : 'uptime',
        'metricset.period'                : metricsetPeriod,
        'service.type'                    : 'slingshot-host',
        'system.uptime.duration.ms'       : ({ values }) => values.uptime,
      },
    ],
  };
};


