const { Client } = require("./es");
const get_logger = require("./logger");
const dot = require("dot-object");
const Mustache = require("mustache");

module.exports = async function load(initialize, options) {
  const type_options = options.types[options.doc_type];
  const client = new Client(options.elasticsearch);
  const logger = get_logger(options);

  if (!type_options || !type_options.indices) {
    logger.error(`Invalid doc_type: ${options.doc_type}`);
    process.exit();
  }

  const METRICS_INDEX = type_options.indices.metrics;

  logger.info("Starting slingshot data loading process");
  logger.verbose("Slingshot verbose logging is turned on");
  logger.error("This is an example of a slingshot error log");

  let cycles = 0;

  async function write_data() {
    const CYCLE_NAME = `[CYCLE ${cycles + 1}]`;
    try {
      const { n_docs_per_cycle, create_cycle_values, template } = initialize(
        type_options,
        {
          logger,
        }
      );

      const docs = [];

      logger.info(`${CYCLE_NAME} About to load ${n_docs_per_cycle} documents`);

      for (let i = 0; i < n_docs_per_cycle; i++) {
        const keys = Object.keys(template);
        const values = create_cycle_values(i);

        let doc = keys.reduce((acc, path) => {
          acc[path] =
            typeof template[path] === "string"
              ? Mustache.render(template[path], values)
              : template[path];
          return acc;
        }, {});

        if (options.dry_run) {
          logger.debug(`Would write to index: ${METRICS_INDEX}`);
          logger.debug(JSON.stringify(doc, null, 2));
        }

        dot.object(doc);
        docs.push(doc);
      }

      if (!options.dry_run) {
        const response = await client.batchIndex(docs, {
          index: METRICS_INDEX,
        });

        if (response && response.body && response.body.errors) {
          const items = new Set(
            response.body.items.map((e) => e.index.error.reason)
          );
          const esError = new Error(
            `Errors returned in ES body, ${[...items].join(" | ")}`
          );
          esError.es_errors = response.body.items;
          throw esError;
        }

        logger.info(
          `${CYCLE_NAME} Finished successfully loading ${docs.length} documents`
        );
      }
    } catch (err) {
      logger.error(
        `${CYCLE_NAME} Error(s) while loading documents (turn on verbose logging to see full error result): ${err.message}`
      );
      if (err.es_errors) {
        logger.verbose(JSON.stringify(err.es_errors, null, 2));
      }
      process.exit();
    }

    cycles++;

    const { n, continuous, ms_pause_after_each } = options.cycles;

    if ((n && cycles < n) || continuous) {
      const message_parts = [
        `Will process another cycle of documents in ${
          ms_pause_after_each / 1000
        }s`,
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
