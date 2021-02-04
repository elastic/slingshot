#! /usr/bin/env node

const load = require("../lib/load");
const get_config = require("../lib/get_config");
const init_pod_metrics = require("../doc_types/pod_metrics");
const yargs = require("yargs/yargs");
const argv = yargs(process.argv.slice(2)).argv;
const get_logger = require("../lib/logger");
const dot = require("dot-object");
const now = Date.now();

dot.object(argv);

const doc_type_map = {
  pod: init_pod_metrics,
};

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

/**
 * You can pass in command line flags
 * to override any of these options, e.g.
 *
 * node examples/pod-script.js --dry_run=true
 * node examples/pod-script.js --cycles.continuous=false
 */
const options = get_config(argv);
const logger = get_logger(options);

try {
  if (!options.doc_type) {
    throw new Error(
      "doc_type is a required option, please set in config or on CLI"
    );
  }

  if (!doc_type_map[options.doc_type]) {
    throw new Error(`Invalid type ${options.doc_type}`);
  }

  load(doc_type_map[options.doc_type], options);
} catch (error) {
  logger.info("Error while loading data");
  logger.error(error.message);
  logger.verbose(error.stack);
}
