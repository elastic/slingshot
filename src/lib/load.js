const { Client } = require("./es");
const dot = require("dot-object");
const Mustache = require("mustache");

module.exports = async function load(initialize, options) {
  const client = new Client(options.elasticsearch);

  let cycles = 0;

  async function write_data() {
    try {
      const { n_docs, get_values, template: pod_template } = initialize(
        options
      );
      const docs_written = new Set();
      let i = 0;
      const docs = [];

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

      console.log(`Finished uploading ${docs.length} documents`);
      console.log("Errors:", response && response.body && response.body.errors);
    } catch (err) {
      console.error("Error while pushing documents", err);
      process.exit();
    }

    cycles++;

    if (
      (options.cycles.n && cycles < options.cycles.n) ||
      options.cycles.continuous
    ) {
      setTimeout(write_data, options.cycles.ms_pause_after_each);
    }
  }

  write_data();
};
