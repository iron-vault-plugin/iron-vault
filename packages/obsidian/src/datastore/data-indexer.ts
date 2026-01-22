import { rootLogger } from "logger";
import {
  ProjectableMap,
  projectedVersionedMap,
  ReadonlyVersionedMap,
  VersionedMapImpl,
} from "utils/versioned-map";

const logger = rootLogger.getLogger("data-indexer");

export type Source = {
  path: string;
  priority: number;
  keys: Set<string>;
};

export type SourcedKinds<Kinds> = {
  [K in keyof Kinds]: Sourced<K, Kinds[K]>;
};

export type SourcedKindsArray<Kinds> = {
  [K in keyof Kinds]: Array<Sourced<K, Kinds[K]>>;
};

export type PreSourcedKinds<Kinds> = {
  [K in keyof Kinds]: PreSourced<K, Kinds[K]>;
};

export type SourcedBy<Kinds> = SourcedKinds<Kinds>[keyof Kinds];

// export type SourcedBy<
//   Kinds,
//   Key extends keyof Kinds & string = keyof Kinds & string,
// > = Parameters<<K extends Key>(source: Sourced<K, Kinds[K]>) => void>[0];

export type SourcedByArray<Kinds> = SourcedKindsArray<Kinds>[keyof Kinds];

export type PreSourcedBy<Kinds> = PreSourcedKinds<Kinds>[keyof Kinds];

export interface Sourced<Kind, V> {
  readonly id: string;
  readonly source: Source;
  readonly kind: Kind;
  readonly value: V;
}

export type PreSourced<Kind, V> = Omit<Sourced<Kind, V>, "source">;

export function assertIsKind<Kinds, K extends keyof Kinds & string>(
  sourced: SourcedBy<Kinds>,
  kind: K,
): asserts sourced is keyof Kinds extends string
  ? SourcedKinds<Kinds>[K]
  : never {
  if (!sourced) {
    throw new Error(`sourced was undefined`);
  }
  if (sourced.kind !== kind) {
    throw new Error(
      `expected kind '${String(kind)}'; received '${String(sourced.kind)}`,
    );
  }
}

export type StandardIndex<V> = ProjectableMap<string, V>;

export function isOfKind<Kinds, Key extends keyof Kinds>(
  arr: SourcedByArray<Kinds>,
  kind: Key,
): arr is SourcedKindsArray<Kinds>[Key] {
  return arr[0]!.kind === kind;
}

export function kindFiltered<
  Kinds extends Record<string, unknown>,
  Kind extends keyof Kinds,
>(
  kind: Kind,
  map: ProjectableMap<string, SourcedByArray<Kinds>>,
): ProjectableMap<string, SourcedKindsArray<Kinds>[Kind]> {
  return projectedVersionedMap(map, (entries) =>
    isOfKind(entries, kind) ? entries : undefined,
  );
}

export function prioritized<
  A extends SourcedKindsArray<Kinds>[Kind],
  Kinds extends Record<string, unknown>,
  Kind extends keyof Kinds = keyof Kinds,
>(
  map: ProjectableMap<string, A>,
): ProjectableMap<string, SourcedKinds<Kinds>[Kind]> {
  return projectedVersionedMap(map, (entries) => getHighestPriority(entries));
}

// export interface SourcedMap<
//   Kinds extends Record<string, unknown>,
//   Kind extends keyof Kinds = keyof Kinds,
// > extends VersionedMap<string, SourcedKindsArray<Kinds>[Kind]> {

//   byKind<K extends Kind>(
//     kind: K,
//   ): ProjectableMap<string, SourcedKindsArray<Kinds>[K]>;

// }

/** A map of typed sourced entries that retrieves the highest-priority variant by default. */
export interface SourcedMap<
  Kinds extends Record<string, unknown>,
  Kind extends keyof Kinds = keyof Kinds,
> extends ProjectableMap<string, SourcedKinds<Kinds>[Kind]> {
  /** Returns "inner" map that contains ALL  */
  readonly all: ReadonlyVersionedMap<string, SourcedKindsArray<Kinds>[Kind]>;
  ofKind<K extends Kind>(kind: K): SourcedMap<Kinds, K>;
}

export class SourcedMapImpl<
  Kinds extends Record<string, unknown>,
  Kind extends keyof Kinds = keyof Kinds,
> implements SourcedMap<Kinds, Kind> {
  constructor(
    readonly all: ReadonlyVersionedMap<string, SourcedKindsArray<Kinds>[Kind]>,
  ) {}

  forEach(
    callbackfn: (
      value: SourcedKinds<Kinds>[Kind],
      key: string,
      map: ReadonlyMap<string, SourcedKinds<Kinds>[Kind]>,
    ) => void,
    thisArg?: unknown,
  ): void {
    this.all.forEach(
      (val, key) => callbackfn(getHighestPriorityChecked(val), key, this),
      thisArg,
    );
  }

  get(key: string): SourcedKinds<Kinds>[Kind] | undefined {
    const result = this.all.get(key);
    return result && getHighestPriorityChecked(result);
  }
  has(key: string): boolean {
    return this.all.has(key);
  }
  get size(): number {
    return this.all.size;
  }
  *entries(): MapIterator<[string, SourcedKinds<Kinds>[Kind]]> {
    for (const [key, values] of this.all.entries()) {
      yield [key, getHighestPriorityChecked(values)];
    }
  }
  keys(): MapIterator<string> {
    return this.all.keys();
  }
  *values(): MapIterator<SourcedKinds<Kinds>[Kind]> {
    for (const values of this.all.values()) {
      yield getHighestPriorityChecked(values);
    }
  }
  [Symbol.iterator](): MapIterator<[string, SourcedKinds<Kinds>[Kind]]> {
    return this.entries();
  }

  get revision(): number {
    return this.all.revision;
  }

  ofKind<K extends Kind>(kind: K): SourcedMapImpl<Kinds, K> {
    // TODO(@cwegrzyn): when caching is implemented, this could be cached for each kind
    return new SourcedMapImpl(
      projectedVersionedMap(this.all, (entries) =>
        isOfKind(entries, kind) ? entries : undefined,
      ),
    );
  }

  projected<U>(
    callbackfn: (
      value: SourcedKinds<Kinds>[Kind],
      key: string,
    ) => U | undefined,
  ): ProjectableMap<string, U> {
    return projectedVersionedMap(this, callbackfn);
  }
}

export type DataIndex<Kinds extends Record<string, unknown>> =
  ReadonlyVersionedMap<string, SourcedByArray<Kinds>>;

export class DataIndexer<
  Kinds extends Record<string, unknown>,
> implements ProjectableMap<string, SourcedByArray<Kinds>> {
  /** Maps keys to source data */
  private readonly _dataMap: VersionedMapImpl<string, SourcedByArray<Kinds>> =
    new VersionedMapImpl();

  /** Index of sources to source details (including key set) */
  public readonly sourceIndex: Map<string, Source> = new Map();

  public readonly prioritized: SourcedMap<Kinds> = new SourcedMapImpl(
    this._dataMap,
  );

  projected<U>(
    callbackfn: <K extends keyof Kinds>(
      value: SourcedKindsArray<Kinds>[K],
      key: string,
    ) => U | undefined,
  ): ProjectableMap<string, U> {
    return projectedVersionedMap(this._dataMap, callbackfn);
  }

  get dataMap(): DataIndex<Kinds> {
    return this._dataMap;
  }

  forEach(
    callbackfn: (
      value: SourcedByArray<Kinds>,
      key: string,
      map: ReadonlyMap<string, SourcedByArray<Kinds>>,
    ) => void,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    thisArg?: any,
  ): void {
    return this._dataMap.forEach(callbackfn, thisArg);
  }

  get(key: string): SourcedByArray<Kinds> | undefined {
    return this._dataMap.get(key);
  }

  has(key: string): boolean {
    return this._dataMap.has(key);
  }

  get size(): number {
    return this._dataMap.size;
  }

  entries(): MapIterator<[string, SourcedByArray<Kinds>]> {
    return this._dataMap.entries();
  }

  keys(): MapIterator<string> {
    return this._dataMap.keys();
  }

  values(): MapIterator<SourcedByArray<Kinds>> {
    return this._dataMap.values();
  }

  [Symbol.iterator](): MapIterator<[string, SourcedByArray<Kinds>]> {
    return this._dataMap[Symbol.iterator]();
  }

  constructor() {}

  clear(): void {
    this._dataMap.clear();
    this.sourceIndex.clear();
  }

  /** Checks if a source is registered. */
  hasSource(path: string): boolean {
    return this.sourceIndex.has(path);
  }

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

    // Remove all of the entries for this source
    this._dataMap.asSingleRevision(() => {
      for (const key of source.keys) {
        const entries = this._dataMap.get(key);
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
          this._dataMap.delete(key);
        }
      }
    });

    this.sourceIndex.delete(path);
    return true;
  }

  index(source: Source, data: Iterable<PreSourcedBy<Kinds>>): void {
    const { path } = source;

    logger.debug("[source:%s] Starting index", source.path);

    this._dataMap.asSingleRevision(() => {
      // TODO: maybe there is a more efficient way than removing and re-adding, but this will work
      this.removeSource(path);

      const keys: Set<string> = (source.keys = new Set());
      this.sourceIndex.set(path, source);

      try {
        for (const datum of data) {
          const { id } = datum;

          const entries: SourcedByArray<Kinds> = this._dataMap.get(id) ?? [];
          if (entries.length > 0 && entries[0].kind !== datum.kind) {
            throw new Error(
              `while indexing '${path}', '${id}' had kind '${String(datum.kind)}' which conflicted with existing kind '${String(entries[0].kind)}' from '${entries[0].source.path}'`,
            );
          }
          keys.add(id);
          entries.push({ ...datum, source });
          this._dataMap.set(id, entries);
        }

        logger.debug(
          "[source:%s] Index finished. %d entries indexed.",
          source.path,
          keys.size,
        );
      } catch (err) {
        logger.warn(
          "[source:%s] caught error while indexing. removing from index...",
          path,
        );
        this.removeSource(path);
        throw err;
      }
    });
  }

  get revision(): number {
    return this._dataMap.revision;
  }
}

export function lookupPriority<K, V>(
  map: ReadonlyVersionedMap<string, Sourced<K, V>[]>,
  id: string,
): Sourced<K, V> | undefined {
  const entries = map.get(id);
  return entries && getHighestPriority(entries);
}

export function getHighestPriorityChecked<Kinds, Key extends keyof Kinds>(
  entries: SourcedKindsArray<Kinds>[Key],
): SourcedKinds<Kinds>[Key] {
  if (entries.length == 0) {
    throw new Error("unexpected empty entry list");
  }
  return getHighestPriority(entries)!;
}

export function getHighestPriority<K, V>(
  entries: Sourced<K, V>[],
): Sourced<K, V> | undefined {
  // eslint-disable-next-line prefer-const
  let [first, ...rest] = entries;
  if (first === undefined) {
    return undefined;
  } else if (rest.length === 0) {
    return first;
  } else {
    for (const next of rest) {
      if (next.source.priority > first.source.priority) {
        first = next;
      }
    }
    return first;
  }
}
