export type Logger = {
  debug: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  info: (...args: unknown[]) => void;
  log(...args: unknown[]): unknown;
};

export let logger: Logger = {
  debug: () => {},
  error: () => {},
  warn: () => {},
  info: () => {},
  log: () => {},
};

export function setLogger(newLogger: Logger): void {
  logger = newLogger;
}
