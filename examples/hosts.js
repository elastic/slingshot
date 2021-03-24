const load = require("../src/lib/load");
const get_config = require("../src/lib/get_config");
const initHostMetrics = require("../src/doc_types/host_metrics");
const yargs = require("yargs/yargs");
const argv = yargs(process.argv.slice(2)).argv;
const dot = require("dot-object");
const merge = require("lodash.merge");
const moment = require('moment');
const { random, range, sample } = require('lodash');

dot.object(argv);

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const KILOBYTE = 1000;
const MEGABYTE = Math.pow(KILOBYTE, 2);

/**
 * These examples do NOT use the yml config files, but define
 * config here in JS instead. You can pass in command line flags
 * to override any of these options, e.g.
 *
 * node examples/pod-script.js --dry_run=true
 * node examples/pod-script.js --cycles.continuous=false
 */

const SAMPLE_CACHE = {};
const createSample = (metric, start = 0, end = 23) => time => {
  const key = `${metric}-${time.dayOfYear()}`;
  if (!SAMPLE_CACHE[key]) {
    SAMPLE_CACHE[key] = [random(start, end)]
  }
  return SAMPLE_CACHE[key];
}

const options = get_config(
  merge(
    {},
    {
      elasticsearch: {
        node: "https://localhost:9200",
        auth: {
          username: "elastic",
          password: "changeme",
        },
      },
      doc_type: "host",
      logging: {
        level: "info",
      },
      dry_run: false,
      // cycles: {
      //   continuous: true, // script will run continuously, like n = Infinity
      //   ms_pause_after_each: 10000, // script will wait this long after each cycle (each batch of docs is a cycle)
      //   // n: 3 // script will run this number of times, and then stop
      // },
      history: {
        from: moment().subtract(13, 'days').startOf('day').valueOf(),
        to: moment().add(1, 'days').endOf('day').valueOf(),
        interval: 10000,
      },
      types: {
        host: {
          n_hosts: 10,
          cloud: true,
          spike: {
            memory: {
              hours: createSample('memory', 0, 11),
              minutes: range(0, 59),
              mean: 1,
              stdev: 0
            },
            rx: {
              hours: createSample('rx'),
              minutes: range(0, 59),
              mean: MEGABYTE * 10,
              stdev: MEGABYTE
            },
          },
          metrics: {
            memory: { mean: 0.6, stdev: 0 },
            cpu: { mean: 0.4, stdev: 0.1 },
            load: { mean: 1, stdev: 0.1 },
            rx: { mean: KILOBYTE, stdev: KILOBYTE / 2 },
            tx: { mean: KILOBYTE, stdev: KILOBYTE / 2 },
          }
        },
      },
    },
    argv
  )
);

load(initHostMetrics, options);

