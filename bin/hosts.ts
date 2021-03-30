#!/usr/bin/env ts-node
import yargs from 'yargs/yargs';
import dotObject from 'dot-object';
import { getConfig } from '../src/lib/get_config';
import { load } from '../src/lib/load';

const argv = yargs(process.argv.slice(2)).argv;

dotObject.object(argv);

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
/**
 * These examples do NOT use the yml config files, but define
 * config here in JS instead. You can pass in command line flags
 * to override any of these options, e.g.
 *
 * node examples/pod-script.js --dry_run=true
 * node examples/pod-script.js --cycles.continuous=false
 */

const options = getConfig({
  elasticsearch: {
    node: 'https://localhost:9200',
    auth: {
      username: 'elastic',
      password: 'changeme'
    }
  },
  logging: {
    level: 'info'
  },
  timerange: {
    start: 'now-7d/d',
    end: 'now+7d/d',
    interval: 10000
  },
  types: {
    hosts: {
      total: 10,
      addCloudData: true,
      spike: [
        { name: 'memory', mean: 1, stdev: 0, duration: '1m' },
        { name: 'rx', mean: 100000, stdev: 50000, duration: '1h' }
      ],
      normal: [
        { name: 'cpu', mean: 0.5, stdev: 0.2 },
        { name: 'memory', mean: 0.7, stdev: 0 },
        { name: 'load', mean: 1, stdev: 0.5 },
        { name: 'rx', mean: 1000, stdev: 500 },
        { name: 'tx', mean: 1000, stdev: 500 }
      ]
    }
  }
});

load(options);
