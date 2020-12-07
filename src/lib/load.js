const { Client } = require("./es");
const get_logger = require("./logger");
const dot = require("dot-object");
const Mustache = require("mustache");
const { option, options } = require("yargs");

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

  function generate_cycle_docs(n_docs_per_cycle, create_cycle_values, template) {
    const docs = [];
    for (let i = 0; i < n_docs_per_cycle; i++) {
      const keys = Object.keys(template);
      const values = create_cycle_values(i);
  
      let doc = keys.reduce((acc, path) => {
        acc[path] =
          typeof template[path] === "string"
            ? Mustache.render(template[path], values)
            : typeof template[path] === "function"
            ? template[path](values)
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
    return docs;
  }
  
  async function index_docs(docs) {
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
  }

  let cycles = 0;

  async function write_data() {
    const CYCLE_NAME = `[CYCLE ${cycles + 1}]`;
    try {
      const { n_docs_per_cycle, create_cycle_values, template } = initialize(
        type_options,
        Date.now(),
        {
          logger,
        }
      );

      logger.info(`${CYCLE_NAME} About to load ${n_docs_per_cycle} documents`);
      const docs = generate_cycle_docs(n_docs_per_cycle, create_cycle_values, template);

      if (!options.dry_run) {
        await index_docs(docs);

        logger.info(
          `${CYCLE_NAME} Finished successfully loading ${docs.length} documents`
        );
      }
    } catch (err) {
      logger.error(
        `${CYCLE_NAME} Error(s) while loading documents (turn on verbose logging to see full error result): ${err.message}`
      );``
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

  async function write_history_data() {
    const history_docs = [];
    logger.info(`Preparing to generate ${Math.ceil((options.history.to - options.history.from) / options.history.interval)} cycles of history documents`);
    try {
      for (let now = options.history.from; now <= options.history.to; now += options.history.interval) {
        const { n_docs_per_cycle, create_cycle_values, template } = initialize(
          type_options,
          now,
          {
            logger,
          }
        );
        const docs = generate_cycle_docs(n_docs_per_cycle, create_cycle_values, template);
        docs.forEach(doc => history_docs.push(doc))
        logger.info(`Generated ${history_docs.length} history docs, ${Math.ceil((options.history.to - now) / options.history.interval)} cycles remaining`)
      }
      
      if (!options.dry_run) {
        logger.info('Indexing history docs...')
        await index_docs(history_docs);
        logger.info(
          `Finished generating ${history_docs.length} history documents`
        )
      }
    } catch (err) {
      logger.error(
        `${CYCLE_NAME} Error(s) while loading documents (turn on verbose logging to see full error result): ${err.message}`
      );``
      if (err.es_errors) {
        logger.verbose(JSON.stringify(err.es_errors, null, 2));
      }
      process.exit();
    }

  }

  if (options.history) {
    write_history_data();
  }
  if (options.cycles) {
    write_data();
  }
};
