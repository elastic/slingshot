const { Client } = require("./es");
const get_logger = require("./logger");
const dot = require("dot-object");
const Mustache = require("mustache");

module.exports = async function load(initialize, options) {
  const type_options = options.types[options.doc_type];
  const client = new Client(options.elasticsearch);
  const logger = get_logger(options);

  // if (!type_options || !type_options.index) {
  //   logger.error(
  //     `Invalid doc_type: ${options.doc_type}, missing options (${doc_type}.index is required)`
  //   );
  //   process.exit();
  // }

  logger.info("Starting slingshot data loading process");
  logger.verbose("Slingshot verbose logging is turned on");

  function generate_cycle_docs(
    n_docs_per_cycle,
    create_cycle_values,
    template,
    now
  ) {
    const docs = [];
    for (let i = 0; i < n_docs_per_cycle; i++) {
      const keys = Object.keys(template);
      const values = create_cycle_values(i, now);

      let doc = keys.reduce((acc, path) => {
        acc[path] =
          typeof template[path] === "string"
            ? Mustache.render(template[path], values)
            : typeof template[path] === "function"
            ? template[path](values)
            : template[path];
        return acc;
      }, {});

      logger.debug(JSON.stringify(doc, null, 2));
      dot.object(doc);
      docs.push(doc);
    }
    return docs;
  }

  async function index_docs(index, docs) {
    const response = await client.batchIndex(docs, {
      index,
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
      const {
        n_docs_per_cycle,
        create_cycle_values,
        template,
        index,
      } = initialize(type_options, {
        logger,
      });

      logger.info(`${CYCLE_NAME} About to load ${n_docs_per_cycle} documents`);
      const docs = generate_cycle_docs(
        n_docs_per_cycle,
        create_cycle_values,
        template,
        Date.now()
      );

      if (!options.dry_run) {
        await index_docs(index, docs);

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

  async function write_history_data() {
    const history_docs = [];
    // default to is right now, default interval is 5 min in nanoseconds
    const { from, to = Date.now(), interval = 300000 } = options.history;
    logger.verbose(`from: ${from}, to: ${to}, interval: ${interval}`);

    logger.info(
      `Preparing to generate ${Math.ceil(
        (to - from) / interval
      )} cycles of history documents, one cycle every ${
        interval / 1000
      }s between ${new Date(from).toLocaleString()} and ${new Date(
        to
      ).toLocaleString()}`
    );
    const {
      n_docs_per_cycle,
      create_cycle_values,
      template,
      index,
    } = initialize(type_options, { logger });

    try {
      for (let now = from; now <= to; now += interval) {
        const docs = generate_cycle_docs(
          n_docs_per_cycle,
          create_cycle_values,
          template,
          now
        );
        docs.forEach((doc) => history_docs.push(doc));
        logger.verbose(
          `Generated ${history_docs.length} history docs, ${Math.ceil(
            (to - now) / interval
          )} cycles remaining`
        );
      }

      if (!options.dry_run) {
        logger.info("Indexing history docs...");
        await index_docs(index, history_docs);
        logger.info(
          `Finished generating ${history_docs.length} history documents`
        );
      }
    } catch (err) {
      logger.error(
        ` Error(s) while loading documents (turn on verbose logging to see full error result): ${err.message}`
      );
      if (err.es_errors) {
        logger.verbose(JSON.stringify(err.es_errors, null, 2));
      }
      process.exit();
    }
  }

  if (options.history) {
    logger.verbose("Writing history data");
    write_history_data();
  } else if (options.cycles) {
    logger.verbose("Writing real-time data");
    write_data();
  } else {
    logger.warn(
      "No 'history' or 'cycle' blocks configured, no documents written"
    );
  }
};
