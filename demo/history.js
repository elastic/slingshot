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
      user_config_path: __dirname + "/demo.config.yml",
      doc_type: "pod",
      history: {
        from: now - 1 * 24 * 60 * 60 * 1000, // 24 hours ago
        to: now,
        interval: 300000, // 5 min interval
      },
      types: {
        pod: {
          n_hosts: 3,
          n_pods: 10,
          metrics: {
            cpu: {
              mean: 0.3,
              stdev: 0.15,
            },
            memory: {
              mean: 0.3,
              stdev: 0.15,
            },
          },
        },
      },
    },
    argv
  )
);

load(init_pod_metrics, options);
