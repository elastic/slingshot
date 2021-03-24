const { Client } = require("./es");
const get_logger = require("./logger");
const dot = require("dot-object");
const Mustache = require("mustache");
const moment = require('moment');
const { setWith } = require('lodash');

module.exports = async function load(initialize, options) {
  const type_options = options.types[options.doc_type];
  const client = new Client(options.elasticsearch);
  const logger = get_logger(options);
  const masterTime = moment();

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
    time
  ) {
    const docs = [];
    for (let i = 0; i < n_docs_per_cycle; i++) {
      const templates = Array.isArray(template) ? template : [template];
      const cycleValues = create_cycle_values(i, time);
      templates.forEach(template => {
        const keys = Object.keys(template);

        let doc = keys.reduce((acc, path) => {
          const value = typeof template[path] === "string"
              ? Mustache.render(template[path], cycleValues)
              : typeof template[path] === "function"
              ? template[path](cycleValues)
              : template[path];
          setWith(acc, path, value, Object);
          return acc;
        }, {});

        logger.debug(JSON.stringify(doc, null, 2));
        dot.object(doc);
        docs.push(doc);
      });
    }
    return docs;
  }

  async function index_docs(index, docs) {
    const response = await client.batchIndex(docs, {
      index,
    });

    if (response && response.body && response.body.errors) {
      const items = new Set(
        response.body.items.map((e) => e.index && e.index.error && e.index.error.reason || 'unknown')
      );
      const esError = new Error(
        `Errors returned in ES body, ${[...items].join(" | ")}`
      );
      esError.es_errors = response.body.items;
      throw esError;
    }
  }

  let cycles = 0;
  const { n, continuous, ms_pause_after_each } = options.cycles;

  async function write_data() {
    const CYCLE_NAME = `[CYCLE ${cycles + 1}]`;
    const now = moment();
    try {
      const {
        n_docs_per_cycle,
        create_cycle_values,
        template,
        index,
      } = initialize(type_options, {
        logger,
      });

      if (masterTime.isSameOrAfter(now)) {
        logger.debug(`Waiting for ${masterTime.valueOf() - now.valueOf()}ms`);
        return setTimeout(write_data, masterTime.valueOf() - now.valueOf());
      }

      logger.info(`${CYCLE_NAME} About to load ${n_docs_per_cycle} documents`);
      const docs = generate_cycle_docs(
        n_docs_per_cycle,
        create_cycle_values,
        template,
        masterTime.add(ms_pause_after_each, 'ms')
      );

      if (!options.dry_run) {
        await index_docs(index, docs);

        logger.info(
          `${CYCLE_NAME} Finished successfully loading ${docs.length} documents`
        );
      }
    } catch (err) {
      console.log(err);
      logger.error(
        `${CYCLE_NAME} Error(s) while loading documents (turn on verbose logging to see full error result): ${err.message}`
      );
      if (err.es_errors) {
        logger.verbose(JSON.stringify(err.es_errors, null, 2));
      }
      process.exit();
    }

    cycles++;


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
      write_data();
    }
  }

  async function write_history_data() {
    // default to is right now, default interval is 5 min in nanoseconds
    const { from, to = Date.now(), interval = 300000 } = options.history;
    logger.verbose(`from: ${from}, to: ${to}, interval: ${interval}`);

    const fromTime = moment(from);
    const toTime = moment(to);

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

    let docQueue = [];

    try {
      while(fromTime.isBefore(toTime)) {
        const docs = generate_cycle_docs(
          n_docs_per_cycle,
          create_cycle_values,
          template,
          fromTime.add(interval, 'ms')
        );
        logger.verbose(
          `Generated ${docs.length} history docs, ${Math.ceil(
            (to - fromTime.valueOf()) / interval
          )} cycles remaining`
        );

        docs.forEach(d => docQueue.push(d));

        if (!options.dry_run && docQueue.length >= 10000) {
          logger.info("Indexing history docs...");
          await index_docs(index, docQueue);
          logger.info(
            `Finished generating ${docQueue.length} history documents`
          );
          docQueue = [];
        }
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
  }
  else {
    logger.warn(
      "No 'history' or 'cycle' blocks configured, no documents written"
    );
  }
};
