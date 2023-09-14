import { groupBy, map, omit } from 'lodash';

import { Client } from './es';

export async function indexDocs(client: Client, index: string, docs: any[]) {
  const docsByIndex = groupBy(docs, (doc) => {
    return doc._index || index;
  });

  const requests = map(docsByIndex, (batch, index) => {
    return client.batchIndex(
      batch.map((doc) => omit(doc, ['_index'])),
      {
        index,
      }
    );
  });

  await Promise.all(requests).then((responses) => {
    const errorMessages = responses
      .map((response) => {
        if (response && response.body && response.body.errors) {
          let index;
          const items = new Set(
            response.body.items.map((e: any) => {
              const op = e.index || e.create;
              index = op?._index;
              return op?.error?.reason || 'unknown';
            })
          );
          return `Errors returned in ES body for index '${index}', ${[...items].join(' | ')}`;
        }
      })
      .filter(Boolean);

    if (errorMessages.length) {
      throw new Error(errorMessages.join('\n\n'));
    }
  });
}
