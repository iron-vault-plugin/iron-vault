interface Source<K extends string> {
  path: string;
  priority: number;
  keys: Set<K>;
}

export interface Sourced<K extends string, V> {
  readonly source: Source<K>;
  readonly value: V;
}

export type ReadonlySourced<K extends string, V> = Sourced<K, V> & {
  readonly source: Readonly<Source<K>>;
};

function getHighestPriorityChecked<K extends string, V>(
  entries: Array<Sourced<K, V>>,
): Sourced<K, V> {
  if (entries.length == 0) {
    throw new Error("unexpected empty entry list");
  }
  return getHighestPriority(entries)!;
}

function getHighestPriority<K extends string, V>(
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

export type IndexableData<K extends string, V> =
  | Record<K, V>
  | Iterable<[K, V]>;

export type StandardIndex<V> = ReadonlyMap<string, V>;

export class PriorityIndexer<K extends string, V> implements ReadonlyMap<K, V> {
  /** Maps keys to source path */
  public readonly dataMap: Map<K, Array<Sourced<K, V>>>;

  /** Index of sources to source details (including key set) */
  public readonly sourceIndex: Map<string, Source<K>>;

  constructor() {
    this.dataMap = new Map();
    this.sourceIndex = new Map();
  }

  forEach(
    _callbackfn: (value: V, key: K, map: ReadonlyMap<K, V>) => void,
    _thisArg?: unknown,
  ): void {
    throw new Error("Method not implemented.");
  }

  get size(): number {
    return this.dataMap.size;
  }

  *entries(): IterableIterator<[K, V]> {
    for (const [key, values] of this.dataMap.entries()) {
      yield [key, getHighestPriorityChecked(values).value];
    }
  }

  keys(): IterableIterator<K> {
    return this.dataMap.keys();
  }

  *values(): IterableIterator<V> {
    for (const values of this.dataMap.values()) {
      yield getHighestPriorityChecked(values).value;
    }
  }

  [Symbol.iterator](): IterableIterator<[K, V]> {
    throw new Error("Method not implemented.");
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

  indexSource(
    path: string,
    priority: number,
    dataset: IndexableData<K, V>,
  ): void {
    let iterator: Iterable<[K, V]>;
    if (Symbol.iterator in dataset) {
      iterator = dataset;
    } else {
      iterator = Object.entries(dataset) as [K, V][];
    }
    // TODO: maybe there is a more efficient way than removing and re-adding, but this will work
    this.removeSource(path);
    const keys: Set<K> = new Set();
    const source: Source<K> = {
      path,
      priority,
      keys,
    };
    this.sourceIndex.set(path, source);

    for (const [k, value] of iterator) {
      const entries = this.dataMap.get(k) ?? [];
      keys.add(k);
      entries.push({ source, value });
      this.dataMap.set(k, entries);
    }
  }

  get(key: K): V | undefined {
    return getHighestPriority(this.dataMap.get(key) ?? [])?.value;
  }

  has(key: K): boolean {
    return (this.dataMap.get(key)?.length ?? 0) > 0;
  }
}
