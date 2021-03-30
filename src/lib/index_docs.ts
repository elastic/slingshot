import { Client } from './es';

export async function indexDocs(client: Client, index: string, docs: any[]) {
  const response = await client.batchIndex(docs, {
    index
  });

  if (response && response.body && response.body.errors) {
    const items = new Set(
      response.body.errors.map(
        (e: any) =>
          (e.index && e.index.error && e.index.error.reason) || 'unknown'
      )
    );
    const esError = new Error(
      `Errors returned in ES body, ${[...items].join(' | ')}`
    );
    throw esError;
  }
}
