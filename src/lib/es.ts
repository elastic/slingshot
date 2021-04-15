import ES from '@elastic/elasticsearch';
import uuid from 'uuid';
import { TransportRequestOptions } from '@elastic/elasticsearch/lib/Transport';
import { Logger } from 'winston';
import { flatMap } from './flat';

export interface ClientBatchIndexOptions extends TransportRequestOptions {
  index: string;
}

export class Client {
  es: ES.Client;
  logger: Logger;

  constructor(config: ES.ClientOptions, logger: Logger) {
    this.es = new ES.Client(config);
    this.logger = logger;
  }

  async purge(dataStream: string) {
    try {
      const response = await this.es.indices.deleteDataStream({
        name: dataStream
      });
      return response;
    } catch (e) {
      if (e.meta.statusCode !== 404) {
        throw e;
      }
      this.logger.info(`  * The data stream "${dataStream}" does not exist.`);
    }
  }

  async batchIndex(
    documents: any[],
    { index, ...options }: ClientBatchIndexOptions
  ) {
    const body = flatMap(documents, doc => [
      { create: { _index: index } },
      doc
    ]);
    return await this.es.bulk({
      refresh: true,
      ...options,
      body
    });
  }

  async create(document: any, index: string) {
    return await this.es.create({
      index,
      id: uuid.v4(),
      body: document
    });
  }
}
