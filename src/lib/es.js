const ES = require("@elastic/elasticsearch");
const { flatMap } = require("./flat");
const uuid = require("uuid");

class Client {
  constructor(config) {
    this.es = new ES.Client(config);
  }

  async batchIndex(documents, { index, ...options }) {
    const body = flatMap(documents, (doc) => [
      { create: { _index: index } },
      doc,
    ]);
    return await this.es.bulk({
      refresh: true,
      ...options,
      body,
    });
  }

  async create(document, index) {
    return await this.es.create({
      index: index,
      id: uuid.v4(),
      body: document,
    });
  }
}

module.exports.Client = Client;
