#!/usr/bin/env ts-node
import yargs from 'yargs/yargs';
import { hideBin } from 'yargs/helpers';
import { set, isNumber, isString } from 'lodash';
import { getConfig } from '../src/lib/get_config';
import { load } from '../src/lib/load';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions
yargs(hideBin(process.argv))
  .command(
    'load',
    'Loads data into Elasticsearch',
    y => {
      y.option('config', {
        description: 'The path to a config file',
        type: 'string',
        required: true
      });
      y.option('start', {
        description: 'Overrides the start date math',
        type: 'string'
      });
      y.option('end', {
        description: 'Overrides the end date math',
        type: 'string'
      });
      y.option('interval', {
        description: 'Overrides the event interval',
        type: 'number'
      });
      y.option('elasticsearch', {
        description: 'Overrides the Elasticsearch connection',
        type: 'string'
      });
      y.option('auth', {
        description: 'Overrides the credentials for Elasticsearch',
        type: 'string'
      });
      y.option('purge', {
        description: 'Deletes data stream before history',
        type: 'boolean'
      });
    },
    argv => {
      // eslint-disable-next-line no-console
      console.log(JSON.stringify(argv));
      if (isString(argv.config)) {
        const configuration = getConfig({}, argv.config);

        if (isString(argv.start)) {
          configuration.timerange.start = argv.start;
        }

        if (isString(argv.end)) {
          configuration.timerange.end = argv.end;
        }

        if (isNumber(argv.interval)) {
          configuration.timerange.interval = argv.interval;
        }

        if (isString(argv.elasticsearch)) {
          set(configuration, 'elasticsearch.node', argv.elasticsearch);
        }

        if (argv.purge) {
          configuration.purge = true;
        }

        if (isString(argv.auth)) {
          const [username, password] = argv.auth.split(':');
          set(configuration, 'elasticsearch.auth.username', username);
          set(configuration, 'elasticsearch.auth.password', password);
        }

        load(configuration);
      }
    }
  )
  .help().argv;
