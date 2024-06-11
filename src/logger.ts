import loglevel from "loglevel";

export const DEFAULT_LOG_LEVEL = loglevel.levels.INFO;
export const LOG_LEVEL_STORAGE_KEY = "iron-vault-log-level";

export const rootLogger = loglevel;

export function initLogger() {
  loglevel.setDefaultLevel(DEFAULT_LOG_LEVEL);
}
export function setLogLevel(level: loglevel.LogLevelDesc) {
  loglevel.setLevel(level, true);
}
