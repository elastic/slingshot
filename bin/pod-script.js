#!/usr/bin/env ts-node
const load = require("../src/lib/load");
const get_config = require("../src/lib/get_config");
const init_pod_metrics = require("../src/doc_types/pod_metrics");
const yargs = require("yargs/yargs");
const argv = yargs(process.argv.slice(2)).argv;
const dot = require("dot-object");
import merge from 'lodash.merge';

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
const now = Date.now();
const options = get_config(
  merge(
    {},
    {
      elasticsearch: {
        node: "https://logs-testing-for-7-12.es.us-central1.gcp.foundit.no:9243",
        auth: {
          username: "elastic",
          password: "2A0nVQ0ONkpOL9WR0RJWCN1k",
        },
      },
      doc_type: "pod",
      logging: {
        level: "info",
      },
      dry_run: false,
      cycles: {
        continuous: true, // script will run continuously, like n = Infinity
        ms_pause_after_each: 10000, // script will wait this long after each cycle (each batch of docs is a cycle)
        // n: 3 // script will run this number of times, and then stop
      },
      // history: {
      //   from: now - 7 * 24 * 60 * 60 * 1000,
      //   to: now,
      //   interval: 60000,
      // },
      types: {
        host: {
          n_hosts: 3,
          metrics: {
            cpu: {
              mean: 0.5,
              stdev: 0.5,
            },
            memory: {
              mean: 0.7,
              stdev: 0.005,
            },

          }
        },
        pod: {
          n_hosts: 3,
          n_pods: 10,
          metrics: {
            cpu: {
              mean: 0.5,
              stdev: 0.2,
            },
            memory: {
              mean: 0.1,
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
