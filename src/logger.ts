import * as winston from "winston";

export const DEFAULT_LOG_LEVEL = "info";
export const LOG_LEVEL_STORAGE_KEY = "iron-vault-log-level";

export const rootLogger = winston.createLogger({
  level: DEFAULT_LOG_LEVEL,
  format: winston.format.json(),
  exitOnError: false,
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.splat(),
        winston.format.colorize(),
        winston.format.printf(
          ({ level, message, module }) => `${level} [${module}] ${message}`,
        ),
      ),
    }),
  ],
});

export function setLogLevel(level: string) {
  rootLogger.level = level;
  try {
    localStorage.setItem(LOG_LEVEL_STORAGE_KEY, level);
  } catch (e) {
    // sad face
  }
}

export function loadLogLevel() {
  let logLevel: string | null = null;
  try {
    logLevel = localStorage.getItem(LOG_LEVEL_STORAGE_KEY);
  } catch (e) {
    // sad face
  }

  if (logLevel) rootLogger.level = logLevel;
}
