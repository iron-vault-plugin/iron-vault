export type Either<T, U> = Left<T> | Right<U>;

export function flatMap<E1, A, E2, B>(
  either: Either<E1, A>,
  f: (a: A) => Either<E2, B>,
): Either<E1 | E2, B> {
  return either.isLeft() ? either : f(either.value);
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

  map<V>(fn: (val: never) => V): Left<T> {
    return this;
  }

  expect(msg: string): never {
    throw new Error(msg, { cause: this.error });
  }

  unwrap(): never {
    return this.expect("expected a value");
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

  mapError<V>(fn: (err: any) => V): Right<U> {
    return this;
  }

  map<V>(fn: (val: U) => V): Right<V> {
    return Right.create<V>(fn(this.value));
  }

  expect(msg: string): U {
    return this.value;
  }

  unwrap(): U {
    return this.expect("expected a value");
  }
}
