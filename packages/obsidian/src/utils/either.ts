export type Either<T, U> = Left<T> | Right<U>;

export function flatMap<E1, A, E2, B>(
  either: Either<E1, A>,
  f: (a: A) => Either<E2, B>,
): Either<E1 | E2, B> {
  return either.isLeft() ? either : f(either.value);
}

export function flattenLeft<E1, E2, A>(
  either: Either<E1, Either<E2, A>>,
): Either<E1 | E2, A> {
  return either.isLeft() ? either : either.value;
}

/** Given a value that may be undefined, return an Either that wraps the value
 * or, if the value is undefined, returns the error.
 */
export function fromUndefined<E, V>(
  value: V | undefined,
  error: () => E,
): Either<E, V> {
  return value === undefined ? Left.create(error()) : Right.create(value);
}

export function trying<T>(fn: () => T): Either<Error, T> {
  try {
    return Right.create(fn());
  } catch (e) {
    if (e instanceof Error) {
      return Left.create(e);
    } else {
      return Left.create(new Error(String(e)));
    }
  }
}

export class Left<T> {
  private constructor(public readonly error: T) {}

  isLeft(): this is Left<T> {
    return true;
  }

  isRight(): this is Right<never> {
    return false;
  }

  static create<U>(error: U): Left<U> {
    return new Left(error);
  }

  mapError<V>(fn: (err: T) => V): Left<V> {
    return Left.create(fn(this.error));
  }

  map<V>(_fn: (val: never) => V): Left<T> {
    return this;
  }

  expect(msg: string): never {
    throw new Error(msg, { cause: this.error });
  }

  unwrap(): never {
    return this.expect(`expected a value, but received error: ${this.error}`);
  }

  unwrapError(): T {
    return this.error;
  }

  getOrElse<A>(orElse: A): A {
    return orElse;
  }
}
export class Right<U> {
  private constructor(public readonly value: U) {}

  isLeft(): this is Left<never> {
    return false;
  }

  isRight(): this is Right<U> {
    return true;
  }

  static create<T>(value: T): Right<T> {
    return new Right(value);
  }

  mapError<V>(_fn: (err: never) => V): Right<U> {
    return this;
  }

  map<V>(fn: (val: U) => V): Right<V> {
    return Right.create<V>(fn(this.value));
  }

  expect(_msg: string): U {
    return this.value;
  }

  unwrap(): U {
    return this.expect("expected a value");
  }

  unwrapError(): never {
    throw new Error("expected an error, but found value");
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  getOrElse(orElse: unknown): U {
    return this.value;
  }
}

export function collectEither<L, R>(
  iterable: Iterable<Either<L, R>>,
): Either<L[], R[]> {
  const errors: L[] = [];
  const results: R[] = [];

  for (const result of iterable) {
    if (result.isLeft()) {
      errors.push(result.error);
    } else if (result.isRight()) {
      results.push(result.value);
    }
  }

  if (errors.length > 0) {
    return Left.create(errors);
  } else {
    return Right.create(results);
  }
}

/** Given an equality function on a type T, create an equality function for
 * Either<unknown, T> that is true if both Either values are Left, or if both
 * Either values are Right and the Right values are equal according to the
 * equality function.
 */
export function makeEitherPartialEquality<T>(
  eq: (a: T, b: T) => boolean,
): (a: Either<unknown, T>, b: Either<unknown, T>) => boolean {
  return (a, b) => {
    if (a.isLeft() && b.isLeft()) {
      return true;
    }
    if (a.isRight() && b.isRight()) {
      return eq(a.value, b.value);
    }
    return false;
  };
}
