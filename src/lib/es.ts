import ES from '@elastic/elasticsearch';
import uuid from 'uuid';
import { TransportRequestOptions } from '@elastic/elasticsearch/lib/Transport';
import { flatMap } from './flat';

export interface ClientBatchIndexOptions extends TransportRequestOptions {
  index: string;
}

export class Client {
  es: ES.Client;

  constructor(config: ES.ClientOptions) {
    this.es = new ES.Client(config);
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
