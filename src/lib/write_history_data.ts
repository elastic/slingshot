import { Logger } from 'winston';
import dateMath from '@elastic/datemath';
import { Client } from './es';
import { Timerange, TypeDef, TypeIntializationFn } from '../types';
import { generateCycleDocs } from './generate_cycle_docs';
import { indexDocs } from './index_docs';

export async function writeHistoryData(
  client: Client,
  logger: Logger,
  timerange: Timerange,
  initialize: TypeIntializationFn,
  typeDef: TypeDef
) {
  // default to is right now, default interval is 5 min in nanoseconds
  logger.verbose(`from: ${timerange.start}, to: ${timerange.end}, interval: ${timerange.interval}`);

  const startTime = dateMath.parse(timerange.start);
  const endTime = dateMath.parse(timerange.end, { roundUp: true });

  if (!startTime) {
    throw new Error(`"${timerange.start}" is not a valid date math expression.`);
  }

  if (!endTime) {
    throw new Error(`"${timerange.end}" is not a valid date math expression.`);
  }

  logger.info(
    `Preparing to generate ${Math.ceil(
      (endTime.valueOf() - startTime.valueOf()) / timerange.interval
    )} cycles of history documents, one cycle every ${timerange.interval /
      1000}s between ${startTime.toLocaleString()} and ${endTime.toLocaleString()}`
  );

  const typeGenerator = initialize(typeDef, { logger });

  let docQueue: any[] = [];

  try {
    while (startTime.isBefore(endTime)) {
      const docs = generateCycleDocs(
        startTime.add(timerange.interval, 'ms'),
        logger,
        typeGenerator
      );
      const cyclesRemaining = Math.ceil(
        (endTime.valueOf() - startTime.valueOf()) / timerange.interval
      );
      logger.verbose(`Generated ${docs.length} history docs, ${cyclesRemaining} cycles remaining`);

      docs.forEach((d: any) => docQueue.push(d));

      if (docQueue.length >= 10000 || cyclesRemaining <= 0) {
        logger.info('Indexing history docs...');
        await indexDocs(client, typeGenerator.index, docQueue);
        logger.info(`Finished generating ${docQueue.length} history documents`);
        docQueue = [];
      }
    }
  } catch (err) {
    logger.error(
      ` Error(s) while loading documents (turn on verbose logging to see full error result): ${
        err.message
      }`
    );
    if (err.es_errors) {
      logger.verbose(JSON.stringify(err.es_errors, null, 2));
    }
    process.exit();
  }
}
