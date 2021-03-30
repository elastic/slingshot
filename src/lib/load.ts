import { ClientOptions } from '@elastic/elasticsearch';
import { getLogger } from './logger';
import { Client } from './es';
import { Configuration, DocTypesRT } from '../types';
import { writeHistoryData } from './write_history_data';
import { docTypes } from '../doc_types';
import { DATA_STREAM } from '../constants';

export async function load(options: Configuration) {
  const logger = getLogger(options.logLevel || 'info');
  const client = new Client(options.elasticsearch as ClientOptions, logger);

  logger.info('Starting slingshot data loading process');
  logger.verbose('Slingshot verbose logging is turned on');

  if (options.timerange) {
    logger.verbose('Writing history data');
    if (options.purge) {
      logger.info(`Purging "${DATA_STREAM}" data stream`);
      await client.purge(DATA_STREAM);
    }
    for (const t in options.types) {
      if (DocTypesRT.is(t)) {
        const typeDef = options.types[t];
        if (!typeDef) {
          throw new Error(`Unable to find type definition for ${t}`);
        }
        const initialize = docTypes[t];
        await writeHistoryData(
          client,
          logger,
          options.timerange,
          initialize,
          typeDef
        );
      }
    }
  } else {
    logger.warn("No 'timerange' block configured, no documents written");
  }
}
