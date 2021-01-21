const load = require("../src/lib/load");
const get_config = require("../src/lib/get_config");
const init_pod_metrics = require("../src/doc_types/pod_metrics");
const yargs = require("yargs/yargs");
const argv = yargs(process.argv.slice(2)).argv;
const dot = require("dot-object");
const merge = require("lodash.merge");
const now = Date.now();

dot.object(argv);

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

/**
 * These examples do NOT use the yml config files, but define
 * config here in JS instead. You can pass in command line flags
 * to override any of these options, e.g.
 *
 * node examples/pod-script.js --dry_run=true
 * node examples/pod-script.js --cycles.continuous=false
 */
const options = get_config(
  merge(
    {},
    {
      user_config_path: __dirname + "/config.yml",
      doc_type: "pod",
      logging: {
        level: "info",
      },
      dry_run: false,
      cycles: {
        continuous: true, // script will run continuously
        ms_pause_after_each: 3000, // script will wait this long after each cycle (each batch of docs is a cycle)
        // n: 3 // script will run this number of times, and then stop
      },
      types: {
        pod: {
          n_hosts: 1,
          n_pods: 1,
          metrics: {
            cpu: {
              mean: 0.95,
              stdev: 0.05,
            },
            memory: {
              mean: 0.95,
              stdev: 0.05,
            },
          },
        },
      },
    },
    argv
  )
);

load(init_pod_metrics, options);
