const { Client } = require("./es");
const get_logger = require("./logger");
const dot = require("dot-object");
const Mustache = require("mustache");

module.exports = async function load(initialize, options) {
  const client = new Client(options.elasticsearch);
  const logger = get_logger(options);

  logger.info("Starting slingshot data loading process");
  logger.verbose("Slingshot verbose logging is turned on");
  logger.error("This is an example of a slingshot error log");

  let cycles = 0;

  async function write_data() {
    try {
      const { n_docs, get_values, template: pod_template } = initialize(
        options,
        { logger }
      );
      const docs_written = new Set();
      let i = 0;
      const docs = [];

      const CYCLE_NAME = `[CYCLE ${cycles + 1}]`;
      logger.info(`${CYCLE_NAME} About to load ${n_docs} documents`);

      for (i; docs_written.size < n_docs; i++) {
        const keys = Object.keys(pod_template);
        const values = get_values(i);
        docs_written.add(values.pod_id);
        let doc = keys.reduce((acc, path) => {
          acc[path] =
            typeof pod_template[path] === "string"
              ? Mustache.render(pod_template[path], values)
              : pod_template[path];
          return acc;
        }, {});

        dot.object(doc);
        docs.push(doc);
      }

      const response =
        !options.dry_run &&
        (await client.batchIndex(docs, {
          index: options.indices.metrics,
        }));

      if (response && response.body && response.body.errors) {
        throw new Error(response.body.errors);
      }

      logger.info(
        `${CYCLE_NAME} Finished successfully loading ${docs.length} documents`
      );
    } catch (err) {
      logger.error(`${CYCLE_NAME} Error while loading documents`, err);
      process.exit();
    }

    cycles++;

    const { n, continuous, ms_pause_after_each } = options.cycles;

    if ((n && cycles < n) || continuous) {
      const message_parts = [
        `Loading another cycle of documents in ${ms_pause_after_each / 1000}s`,
      ];
      if (!continuous) {
        message_parts.push(`(${n - cycles} cycle(s) remaining)`);
      }
      logger.info(message_parts.join(" "));
      setTimeout(write_data, ms_pause_after_each);
    }
  }

  write_data();
};
