import { rootLogger } from "logger";
import { ProjectableMap, projectedVersionedMap } from "utils/versioned-map";

const logger = rootLogger.getLogger("data-indexer");

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

export type SourcedKinds<Kinds> = {
  [K in keyof Kinds]: Sourced<K, Kinds[K]>;
};

export type SourcedKindsArray<Kinds> = {
  [K in keyof Kinds]: Array<Sourced<K, Kinds[K]>>;
};

export type SourcedBy<Kinds> = SourcedKinds<Kinds>[keyof Kinds];

// export type SourcedBy<
//   Kinds,
//   Key extends keyof Kinds & string = keyof Kinds & string,
// > = Parameters<<K extends Key>(source: Sourced<K, Kinds[K]>) => void>[0];

export type SourcedByArray<Kinds> = SourcedKindsArray<Kinds>[keyof Kinds];

export interface Sourced<Kind, V> {
  readonly id: string;
  readonly source: Source;
  readonly kind: Kind;
  readonly value: V;
}

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

export class DataIndexer<Kinds extends Record<string, unknown>>
  implements ProjectableMap<string, SourcedByArray<Kinds>>
{
  /** Maps keys to source data */
  public readonly dataMap: Map<string, SourcedByArray<Kinds>> = new Map();

  /** Index of sources to source details (including key set) */
  public readonly sourceIndex: Map<string, Source> = new Map();

  #revision: number = 0;
  projected<U>(
    callbackfn: (value: SourcedByArray<Kinds>, key: string) => U | undefined,
  ): ProjectableMap<string, U> {
    return projectedVersionedMap(this, callbackfn);
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
    return this.dataMap.forEach(callbackfn, thisArg);
  }

  get(key: string): SourcedByArray<Kinds> | undefined {
    return this.dataMap.get(key);
  }

  has(key: string): boolean {
    return this.dataMap.has(key);
  }

  get size(): number {
    return this.dataMap.size;
  }

  entries(): IterableIterator<[string, SourcedByArray<Kinds>]> {
    return this.dataMap.entries();
  }

  keys(): IterableIterator<string> {
    return this.dataMap.keys();
  }

  values(): IterableIterator<SourcedByArray<Kinds>> {
    return this.dataMap.values();
  }

  [Symbol.iterator](): IterableIterator<[string, SourcedByArray<Kinds>]> {
    return this.dataMap[Symbol.iterator]();
  }

  constructor() {}

  clear(): void {
    this.dataMap.clear();
    this.sourceIndex.clear();
    this.#revision++;
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

    logger.debug("[source:%s] Starting index", source.path);

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

        const entries: SourcedByArray<Kinds> = this.dataMap.get(id) ?? [];
        if (entries.length > 0 && entries[0].kind !== datum.kind) {
          throw new Error(
            `while indexing '${path}', '${id}' had kind '${String(datum.kind)}' which conflicted with existing kind '${String(entries[0].kind)}' from '${entries[0].source.path}'`,
          );
        }
        keys.add(id);
        entries.push(datum);
        this.dataMap.set(id, entries);
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
  }

  get revision(): number {
    return this.#revision;
  }
}

export function getHighestPriorityChecked<Kinds, Key extends keyof Kinds>(
  entries: SourcedKindsArray<Kinds>[Key],
): SourcedKinds<Kinds>[Key] {
  if (entries.length == 0) {
    throw new Error("unexpected empty entry list");
  }
  return getHighestPriority(entries)!;
}

// TODO(@cwegrzyn): the type on this is still bad. It shouldnt need to know about SourcedKinds
//  I think. But I couldn't get it working otherwise. It does mean that type hints need to
//  be provided for this quite often.
export function getHighestPriority<Kinds, Key extends keyof Kinds>(
  entries: SourcedKindsArray<Kinds>[Key],
): SourcedKinds<Kinds>[Key] | undefined {
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
