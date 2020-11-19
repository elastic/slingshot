const yargs = require("yargs/yargs");

yargs(process.argv.slice(2))
  .command(
    "load [type]",
    "load data for a given type",
    (yargs) => {
      yargs.positional("type", {
        describe: "type of data to be loaded, e.g. pods",
        type: "string",
      });
    },
    (argv) => {
      console.log(JSON.stringify(argv));
    }
  )
  .help().argv;
