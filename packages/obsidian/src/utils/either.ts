import { Result } from "true-myth/result";

/** Given a value that may be undefined, return an Either that wraps the value
 * or, if the value is undefined, returns the error.
 */
export function fromUndefined<E, V>(
  value: V | undefined,
  error: () => E,
): Result<V, E> {
  return value === undefined ? Result.err(error()) : Result.ok(value);
}

export function trying<T>(fn: () => T): Result<T, Error> {
  try {
    return Result.ok(fn());
  } catch (e) {
    if (e instanceof Error) {
      return Result.err(e);
    } else {
      return Result.err(new Error(String(e)));
    }
  }
}

export function collectResult<T, E>(
  iterable: Iterable<Result<T, E>>,
): Result<T[], E[]> {
  const errors: E[] = [];
  const results: T[] = [];

  for (const result of iterable) {
    if (result.isErr) {
      errors.push(result.error);
    } else if (result.isOk) {
      results.push(result.value);
    }
  }

  if (errors.length > 0) {
    return Result.err(errors);
  } else {
    return Result.ok(results);
  }
}

/** Given an equality function on a type T, create an equality function for
 * Result<T, unknown> that is true if both Result values are Err, or if both
 * Result values are Ok and the Ok values are equal according to the
 * equality function.
 */
export function makeResultPartialEquality<T>(
  eq: (a: T, b: T) => boolean,
): (a: Result<T, unknown>, b: Result<T, unknown>) => boolean {
  return (a, b) => {
    if (a.isErr && b.isErr) {
      return true;
    }
    if (a.isOk && b.isOk) {
      return eq(a.value, b.value);
    }
    return false;
  };
}
