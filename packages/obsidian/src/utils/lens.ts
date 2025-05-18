import { z } from "zod";

export type Lens<A, B> = {
  get(source: A): B;
  update(source: A, newval: B): A;
};

export type Reader<A, B> = {
  get(source: A): B;
};

export type Writer<A, B> = {
  update(source: A, newval: B): A;
};

export function prop<T, K extends string = string>(
  key: K,
): Lens<Record<string, unknown>, T> {
  return {
    get(source) {
      return source[key] as T;
    },
    update(source, newval) {
      if ((source[key] as T) === newval) return source;
      return { ...source, [key]: newval };
    },
  };
}

export type SchemaProp<
  Output,
  Def extends z.ZodTypeDef = z.ZodTypeDef,
  Input = Output,
> = {
  schema: z.ZodType<Output, Def, Input>;
  path: string;
};

export function lensForSchemaProp<
  Output,
  Def extends z.ZodTypeDef = z.ZodTypeDef,
  Input = Output,
>({
  schema,
  path,
}: SchemaProp<Output, Def, Input>): Lens<Record<string, unknown>, Output> {
  return {
    get(source) {
      return schema.parse(source[path]);
    },
    update(source, newval) {
      if (source[path] === newval) return source;
      // TODO: because we discard the value of parsed here, we will ignore any schema transformations
      // but we aren't handling those transformations in the get either... so...
      const parsed = schema.parse(newval);
      if (source[path] === parsed) return source;
      return { ...source, [path]: parsed };
    },
  };
}
export function objectMap<K extends string, U, V>(
  obj: Record<K, U>,
  fn: (val: U, key: K) => V,
): Record<K, V> {
  return Object.fromEntries(
    Object.entries<U>(obj).map(([key, val]) => [key, fn(val, key as K)]),
  ) as Record<K, V>;
}

export function updating<A, B>(
  lens: Lens<A, B>,
  op: (val: B) => B,
): (source: A) => A {
  return (source: A) => {
    return lens.update(source, op(lens.get(source)));
  };
}

export function reader<A, B>(get: (source: A) => B): Reader<A, B> {
  return {
    get,
  };
}

export function writer<A, B>(
  update: (source: A, newval: B) => A,
): Writer<A, B> {
  return { update };
}

export function addOrUpdateMatching<T, U>(
  arrayLens: Lens<T, U[]>,
  predicate: (existing: U, candidate: U) => boolean,
): Writer<T, U> {
  return writer((source, newElem) => {
    const curArray = arrayLens.get(source);
    const existingIndex = curArray.findIndex((value) =>
      predicate(value, newElem),
    );
    if (existingIndex == -1) {
      return arrayLens.update(source, [...curArray, newElem]);
    } else if (curArray[existingIndex] === newElem) {
      return source;
    } else {
      const newArray = [...curArray];
      newArray[existingIndex] = newElem;
      return arrayLens.update(source, newArray);
    }
  });
}

export function composeRightWriter<T, U, V>(
  leftLens: Lens<T, U>,
  rightLens: Writer<U, V>,
): Writer<T, V> {
  return writer((source, newval) => {
    const intermediate = leftLens.get(source);
    return leftLens.update(source, rightLens.update(intermediate, newval));
  });
}

/** Apply a reader to every element of an array. */
export function arrayReader<T, U>(
  lens: Reader<T, U>,
): Reader<Array<T>, Array<U>> {
  return {
    get(source) {
      return source.map((item) => lens.get(item));
    },
  };
}

/** Read from a lens. */
export function get<T, U>(reader: Reader<T, U>, source: T): U {
  return reader.get(source);
}

export function pipe<T, U, V>(
  left: Reader<T, U>,
  right: Reader<U, V>,
): Reader<T, V> {
  return {
    get(source) {
      return right.get(left.get(source));
    },
  };
}
