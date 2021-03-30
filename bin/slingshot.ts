#!/usr/bin/env ts-node
import yargs from 'yargs/yargs';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions
yargs(process.argv.slice(2))
  .command(
    'load [type]',
    'load data for a given type',
    y => {
      y.positional('type', {
        describe: 'type of data to be loaded, e.g. pods',
        type: 'string'
      });
    },
    argv => {
      // eslint-disable-next-line no-console
      console.log(JSON.stringify(argv));
    }
  )
  .help().argv;
