const { createLogger, format, transports } = require("winston");

module.exports = function get_logger({ logging = {} }) {
  const { level = "info" } = logging;
  const logger = createLogger({
    level,
    format: format.combine(
      format.colorize(),
      format.timestamp(),
      format.printf(
        (info) => `${info.timestamp} ${info.level}: ${info.message}`
      )
    ),
    transports: [new transports.Console()],
  });

  return logger;
};
