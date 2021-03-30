import { getLogger } from './logger';
import { Client } from './es';
import { Configuration, DocTypesRT } from '../types';
import { writeHistoryData } from './write_history_data';
import { docTypes } from '../doc_types';

export async function load(options: Configuration) {
  const client = new Client(options.elasticsearch);
  const logger = getLogger(options);

  logger.info('Starting slingshot data loading process');
  logger.verbose('Slingshot verbose logging is turned on');

  if (options.timerange) {
    logger.verbose('Writing history data');
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
