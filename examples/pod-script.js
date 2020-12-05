const load = require("../src/lib/load");
const get_config = require("../src/lib/get_config");
const init_pod_metrics = require("../src/doc_types/pod_metrics");
const yargs = require("yargs/yargs");
const argv = yargs(process.argv.slice(2)).argv;
const dot = require("dot-object");
const merge = require("lodash.merge");

dot.object(argv);

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
      elasticsearch: {
        node: "YOUR_HOST",
        auth: {
          username: "YOUR_USERNAME",
          password: "YOUR_PASSWORD",
        },
      },
      doc_type: "pod",
      logging: {
        level: "info",
      },
      dry_run: false,
      cycles: {
        continuous: true,
        ms_pause_after_each: 15000,
      },
      types: {
        pod: {
          n_hosts: 3,
          n_pods: 10,
          metrics: {
            cpu: {
              mean: 0.1,
              stdev: 0.1,
            },
            memory: {
              mean: 0.2,
              stdev: 0.1,
            },
          },
        },
      },
    },
    argv
  )
);

console.log(JSON.stringify(options, null, 2));

// load(init_pod_metrics, options);
