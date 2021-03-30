import { createLogger, format, transports } from 'winston';

interface Options {
  logging: {
    level: 'info' | 'debug' | 'verbose';
  };
}

export function getLogger({ logging = { level: 'info' } }: Options) {
  const { level } = logging;
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
