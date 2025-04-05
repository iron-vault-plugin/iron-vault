/** Delay the run of a function associated with a specific key value.
 * If a new call is made before the delay expires, the previous call is cancelled
 * and the new call is scheduled.
 * @param delay The delay in milliseconds before executing the function.
 */
export function debouncerByKey(
  delay: number,
  options: { logger?: (message: string, ...args: unknown[]) => void } = {},
): (key: string) => (fn: () => void) => () => void {
  const timers: Map<string, ReturnType<typeof setTimeout>> = new Map();

  // While a function executes, we want to lock the key to prevent
  // further calls from executing until the lock is released.
  // In the meantime, we will hold the latest function to be executed
  // upon lock release.
  const holds: Map<string, (() => void) | null> = new Map();

  return (key: string) => {
    const cancel = () => {
      if (timers.has(key)) {
        clearTimeout(timers.get(key)!);
        timers.delete(key);
        holds.delete(key);
      }
    };
    const queue = (fn: () => void) => {
      // Something is running for this key, hold the latest function
      if (holds.has(key)) {
        options.logger?.(
          "[debouncerByKey] Holding function for key %s, waiting for lock to be released",
          key,
        );
        holds.set(key, fn);
        return cancel;
      }

      // If we already have a timer, let's cancel it.
      if (timers.has(key)) {
        clearTimeout(timers.get(key)!);
      }

      // Now, we create a new timer
      const timer = setTimeout(() => {
        if (holds.has(key)) {
          options.logger?.(
            "[debouncerByKey] Timer expired but hold exists for key %s (this shouldn't happen)",
            key,
          );
        }
        holds.set(key, null);
        timers.delete(key);
        try {
          fn();
        } finally {
          const nextFn = holds.get(key);
          holds.delete(key);
          if (nextFn) {
            options.logger?.(
              "[debouncerByKey] Triggering held function for key %s",
              key,
            );
            queue(nextFn); // re-queue the next function
          }
        }
      }, delay);
      timers.set(key, timer);
      return cancel;
    };
    return queue;
  };
}
