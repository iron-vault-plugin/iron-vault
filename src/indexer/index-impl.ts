import { Either } from "utils/either";

function filteredReadonlyMap<K, V, U>(
  select: (val: V) => U | undefined,
): new (baseMap: Map<K, V>) => ReadonlyMap<K, U> {
  return class FilteredReadonlyMap implements ReadonlyMap<K, U> {
    #innerMap: ReadonlyMap<K, V>;
    constructor(innerMap: ReadonlyMap<K, V>) {
      this.#innerMap = innerMap;
    }
    forEach(
      callbackfn: (value: U, key: K, map: ReadonlyMap<K, U>) => void,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      thisArg?: any,
    ): void {
      this.#innerMap.forEach((v, key) => {
        const selected = select(v);
        if (selected) {
          callbackfn.bind(thisArg)(selected, key, this);
        }
      }, thisArg);
    }

    get(key: K): U | undefined {
      const val = this.#innerMap.get(key);
      return val && select(val);
    }

    has(key: K): boolean {
      if (!this.#innerMap.has(key)) return false;
      const val = this.#innerMap.get(key);
      return !!select(val!);
    }

    get size(): number {
      let count: number = 0;
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      for (const _key of this.keys()) {
        count++;
      }
      return count;
    }
    entries(): IterableIterator<[K, U]> {
      return this[Symbol.iterator]();
    }
    *keys(): IterableIterator<K> {
      for (const entry of this.#innerMap) {
        yield entry[0];
      }
    }
    *values(): IterableIterator<U> {
      for (const entry of this) {
        yield entry[1];
      }
    }
    *[Symbol.iterator](): IterableIterator<[K, U]> {
      for (const [key, value] of this.#innerMap) {
        const selected = select(value);
        if (selected) {
          yield [key, selected];
        }
      }
    }
  };
}

export function resultFilteredMapClass<K, T, E extends Error>() {
  return filteredReadonlyMap<K, Either<E, T>, T>((result) =>
    result.isRight() ? result.value : undefined,
  );
}

export class Index<T, E extends Error> extends Map<string, Either<E, T>> {
  readonly ofValid: ReadonlyMap<string, T> = new (resultFilteredMapClass<
    string,
    T,
    E
  >())(this);
}
