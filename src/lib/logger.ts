import { createLogger, format, transports } from 'winston';

export function getLogger(level = 'info') {
  const logger = createLogger({
    level,
    format: format.combine(
      format.colorize(),
      format.timestamp(),
      format.printf(info => `${info.timestamp} ${info.level}: ${info.message}`)
    ),
    transports: [new transports.Console()]
  });

  return logger;
}
