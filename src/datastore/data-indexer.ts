export enum SourceTag {
  RulesetId = "ruleset-id",
  ExpansionId = "expansion-id",
}

export type Source = {
  path: string;
  priority: number;
  keys: Set<string>;
  sourceTags: Partial<Record<SourceTag, symbol>>;
};

export type SourcedBy<
  Kinds,
  Key extends keyof Kinds & string = keyof Kinds & string,
> = Parameters<<K extends Key>(source: Sourced<K, Kinds[K]>) => void>[0];

export type SourcedByArray<
  Kinds,
  Key extends keyof Kinds & string = keyof Kinds & string,
> = Parameters<<K extends Key>(source: Sourced<K, Kinds[K]>[]) => void>[0];

export interface Sourced<Kind extends string, V> {
  readonly id: string;
  readonly source: Source;
  readonly kind: Kind;
  readonly value: V;
}

export function assertIsKind<Kinds, K extends keyof Kinds & string>(
  sourced: SourcedBy<Kinds>,
  kind: K,
): asserts sourced is Sourced<K, Kinds[K]> {
  if (!sourced) {
    throw new Error(`sourced was undefined`);
  }
  if (sourced.kind !== kind) {
    throw new Error(
      `expected kind '${String(kind)}'; received '${sourced.kind}`,
    );
  }
}

export type StandardIndex<V> = ProjectableMap<string, V>;

export interface VersionedMap<K, V> extends ReadonlyMap<K, V> {
  get revision(): number;
}

export class VersionedMapImpl<K, V>
  extends Map<K, V>
  implements ProjectableMap<K, V>
{
  #revision: number = 0;

  projected<X>(
    callbackfn: (value: V, key: K) => X | undefined,
  ): ProjectableMap<K, X> {
    return projectedVersionedMap(this, callbackfn);
  }

  set(key: K, value: V): this {
    this.#revision++;
    return super.set(key, value);
  }

  clear(): void {
    this.#revision++;
    return super.clear();
  }

  delete(key: K): boolean {
    if (super.delete(key)) {
      this.#revision++;
      return true;
    }
    return false;
  }

  get revision(): number {
    return this.#revision;
  }
}

export interface ProjectableMap<K, V> extends VersionedMap<K, V> {
  projected<U>(
    callbackfn: (value: V, key: K) => U | undefined,
  ): ProjectableMap<K, U>;
}

export function projectedVersionedMap<K, V, U>(
  baseMap: VersionedMap<K, V>,
  select: (value: V, key: K) => U | undefined,
): ProjectableMap<K, U> {
  const mapClass = class implements ProjectableMap<K, U> {
    #innerMap: VersionedMap<K, V>;

    constructor(innerMap: VersionedMap<K, V>) {
      this.#innerMap = innerMap;
    }
    get revision(): number {
      return this.#innerMap.revision;
    }
    projected<X>(
      callbackfn: (value: U, key: K) => X | undefined,
    ): ProjectableMap<K, X> {
      return projectedVersionedMap(this, callbackfn);
    }

    forEach(
      callbackfn: (value: U, key: K, map: VersionedMap<K, U>) => void,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      thisArg?: any,
    ): void {
      this.#innerMap.forEach((value, key) => {
        const selected = select(value, key);
        if (selected) {
          callbackfn.bind(thisArg)(selected, key, this);
        }
      }, thisArg);
    }

    get(key: K): U | undefined {
      const val = this.#innerMap.get(key);
      return val && select(val, key);
    }

    has(key: K): boolean {
      if (!this.#innerMap.has(key)) return false;
      const val = this.#innerMap.get(key);
      return !!select(val!, key);
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
        const selected = select(value, key);
        if (selected) {
          yield [key, selected];
        }
      }
    }
  };
  return new mapClass(baseMap);
}

export function isOfKind<Kinds, Key extends keyof Kinds & string>(
  arr: SourcedByArray<Kinds>,
  kind: Key,
): arr is SourcedByArray<Kinds, Key> {
  return arr[0]!.kind === kind;
}

export class DataIndexer<Kinds extends Record<string, unknown>>
  implements ProjectableMap<string, SourcedByArray<Kinds>>
{
  /** Maps keys to source data */
  public readonly dataMap: Map<string, SourcedByArray<Kinds>> = new Map();

  /** Index of sources to source details (including key set) */
  public readonly sourceIndex: Map<string, Source> = new Map();

  #revision: number = 0;
  projected<U>(
    callbackfn: (
      value: Sourced<keyof Kinds & string, Kinds[keyof Kinds & string]>[],
      key: string,
    ) => U | undefined,
  ): ProjectableMap<string, U> {
    return projectedVersionedMap(this, callbackfn);
  }

  forEach(
    callbackfn: (
      value: Sourced<keyof Kinds & string, Kinds[keyof Kinds & string]>[],
      key: string,
      map: ReadonlyMap<
        string,
        Sourced<keyof Kinds & string, Kinds[keyof Kinds & string]>[]
      >,
    ) => void,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    thisArg?: any,
  ): void {
    return this.dataMap.forEach(callbackfn, thisArg);
  }

  get(
    key: string,
  ): Sourced<keyof Kinds & string, Kinds[keyof Kinds & string]>[] | undefined {
    return this.dataMap.get(key);
  }

  has(key: string): boolean {
    return this.dataMap.has(key);
  }

  get size(): number {
    return this.dataMap.size;
  }

  entries(): IterableIterator<
    [string, Sourced<keyof Kinds & string, Kinds[keyof Kinds & string]>[]]
  > {
    return this.dataMap.entries();
  }

  keys(): IterableIterator<string> {
    return this.dataMap.keys();
  }

  values(): IterableIterator<
    Sourced<keyof Kinds & string, Kinds[keyof Kinds & string]>[]
  > {
    return this.dataMap.values();
  }

  [Symbol.iterator](): IterableIterator<
    [string, Sourced<keyof Kinds & string, Kinds[keyof Kinds & string]>[]]
  > {
    return this.dataMap[Symbol.iterator]();
  }

  constructor() {}

  renameSource(oldPath: string, newPath: string): void {
    const source = this.sourceIndex.get(oldPath);
    if (source == null) {
      throw new Error(`index has no source ${oldPath}`);
    }
    source.path = newPath;

    this.sourceIndex.delete(oldPath);
    this.sourceIndex.set(newPath, source);
  }

  removeSource(path: string): boolean {
    const source = this.sourceIndex.get(path);
    if (source == null) {
      return false;
    }

    this.#revision++;

    // Remove all of the entries for this source
    for (const key of source.keys) {
      const entries = this.dataMap.get(key);
      const sourceIndex =
        entries?.findIndex(
          ({ source: curSource }) => curSource.path === path,
        ) ?? -1;
      if (entries == null || sourceIndex < 0) {
        throw new Error(
          `index consistency violation: no ${String(
            key,
          )} entry with source ${path}`,
        );
      }
      entries.splice(sourceIndex, 1);
      if (entries.length == 0) {
        this.dataMap.delete(key);
      }
    }
    this.sourceIndex.delete(path);
    return true;
  }

  // TODO: figure out a way to express type Omit<SourcedBy<Kinds>, "source"> that then works when
  // I try to add the source
  index(source: Source, data: Iterable<SourcedBy<Kinds>>): void {
    const { path } = source;

    // TODO: maybe there is a more efficient way than removing and re-adding, but this will work
    if (!this.removeSource(path)) {
      // Remove source will bump the revision, so this ensures we get a new revision;
      this.#revision++;
    }

    const keys: Set<string> = (source.keys = new Set());
    this.sourceIndex.set(path, source);

    try {
      for (const datum of data) {
        const { id } = datum;

        // The data passed here should only ever originate from one source.
        if (datum.source !== source) {
          throw new Error(`datum ${id} had mismatched source`);
        }

        const entries = this.dataMap.get(id) ?? [];
        if (entries.length > 0 && entries[0].kind !== datum.kind) {
          throw new Error(
            `while indexing '${path}', '${id}' had kind '${datum.kind}' which conflicted with existing kind '${entries[0].kind}' from '${entries[0].source.path}'`,
          );
        }
        keys.add(id);
        entries.push(datum);
        this.dataMap.set(id, entries);
      }
    } catch (err) {
      console.warn(
        "caught error while indexing path %s. removing from index...",
        path,
      );
      this.removeSource(path);
      throw err;
    }
  }

  get revision(): number {
    return this.#revision;
  }
}

export function getHighestPriorityChecked<K extends string, V>(
  entries: Array<Sourced<K, V>>,
): Sourced<K, V> {
  if (entries.length == 0) {
    throw new Error("unexpected empty entry list");
  }
  return getHighestPriority(entries)!;
}

export function getHighestPriority<K extends string, V>(
  entries: Array<Sourced<K, V>>,
): Sourced<K, V> | undefined {
  // eslint-disable-next-line prefer-const
  let [first, ...rest] = entries;
  if (first === undefined) {
    return undefined;
  } else if (rest.length === 0) {
    return first;
  } else {
    for (const next of rest) {
      if (next.source.priority < first.source.priority) {
        first = next;
      }
    }
    return first;
  }
}
