const load = require('../src/lib/load');
const get_config = require('../src/lib/get_config');
const init_pod_metrics = require('../src/doc_types/pod_metrics');
const yargs = require('yargs/yargs');
const argv = yargs(process.argv.slice(2)).argv;
const dot = require('dot-object');
const merge = require('lodash.merge');

dot.object(argv);

/**
 * These examples do NOT use the yml config files, but define
 * config here in JS instead. You can pass in command line flags
 * to override any of these options, e.g.
 *
 * node examples/pod-script.js --dry_run=true
 * node examples/pod-script.js --cycles.continuous=false
 */
const now = Date.now();
const options = get_config(
  merge(
    {},
    {
      elasticsearch: {
        node: 'http://localhost:9200',
        auth: {
          username: 'elastic',
          password: 'changeme',
        },
      },
      doc_type: 'pod',
      logging: {
        level: 'info',
      },
      dry_run: false,
      cycles: {
        continuous: true,
        ms_pause_after_each: 15000,
      },
      history: {
        from: now - 7 * 24 * 60 * 60 * 1000,
        to: now,
        interval: 60000,
      },
      types: {
        pod: {
          n_hosts: 3,
          n_pods: 10,
          metrics: {
            cpu: {
              mean: 0.5,
              stdev: 0.2,
            },
            memory: {
              mean: 0.4,
              stdev: 0.2,
            },
          },
        },
      },
    },
    argv
  )
);

load(init_pod_metrics, options);
