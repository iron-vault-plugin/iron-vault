import { enableMapSet, enablePatches, freeze } from "immer";
import { BaseIndexer } from "indexer/manager";
import { TFile, type App, type CachedMetadata } from "obsidian";
import {
  CharacterMetadata,
  CharacterMetadataFactory,
  IronswornCharacterMetadata,
} from "./character";
import { DataIndex } from "./datastore/data-index";

enableMapSet();
enablePatches();

type WithRequired<T, K extends keyof T> = T & { [P in K]-?: T[P] };

export class CharacterTracker implements ReadonlyMap<string, CharacterWrapper> {
  constructor(
    public readonly index: Map<string, CharacterWrapper> = new Map(),
  ) {}

  forEach(
    callbackfn: (
      value: CharacterWrapper,
      key: string,
      map: ReadonlyMap<string, CharacterWrapper>,
    ) => void,
    thisArg?: any,
  ): void {
    this.index.forEach(callbackfn, thisArg);
  }
  get(key: string): CharacterWrapper | undefined {
    return this.index.get(key);
  }
  has(key: string): boolean {
    return this.index.has(key);
  }
  get size(): number {
    return this.index.size;
  }
  entries(): IterableIterator<[string, CharacterWrapper]> {
    return this.index.entries();
  }
  keys(): IterableIterator<string> {
    return this.index.keys();
  }
  values(): IterableIterator<CharacterWrapper> {
    return this.index.values();
  }
  [Symbol.iterator](): IterableIterator<[string, CharacterWrapper]> {
    return this.index[Symbol.iterator]();
  }
}

export class CharacterIndexer extends BaseIndexer<CharacterWrapper> {
  readonly id: string = "character";

  constructor(
    tracker: CharacterTracker,
    protected readonly dataIndex: DataIndex,
  ) {
    super(tracker.index);
  }

  determineSheetClass(
    path: string,
    cache: WithRequired<CachedMetadata, "frontmatter">,
  ): CharacterMetadataFactory<CharacterMetadata> {
    return IronswornCharacterMetadata;
  }

  processFile(
    path: string,
    cache: CachedMetadata,
  ): CharacterWrapper | undefined {
    if (cache.frontmatter == null) {
      throw new Error("missing frontmatter cache");
    }
    return new CharacterWrapper(
      freeze(cache.frontmatter, true),
      this.dataIndex,
      new Set([IronswornCharacterMetadata]), // TODO: right now we're just using ironsworn
    );
  }
}
// class UnwritableMap<K, V> extends Map<K, V> {
//   set(key: K, value: V): this {
//     throw new Error(`attempt to write key ${key} to unwritable map`);
//   }
//   clear(): void {
//     throw new Error("attempt to clear unwritable map");
//   }
//   delete(key: K): boolean {
//     throw new Error(`attempt to delete key ${key} to unwritable map`);
//   }
// }

export class CharacterWrapper {
  constructor(
    protected readonly _data: Readonly<Record<string, any>>,
    protected readonly _index: DataIndex,
    protected readonly _validatedSheets: Set<
      CharacterMetadataFactory<CharacterMetadata>
    >,
  ) {}

  as<T extends CharacterMetadata>(
    kls: CharacterMetadataFactory<T>,
  ): Readonly<T> {
    return this.forUpdates(kls, this._data);
  }

  protected forUpdates<T extends CharacterMetadata>(
    kls: CharacterMetadataFactory<T>,
    data: Record<string, any>,
  ): T {
    if (!this._validatedSheets.has(kls)) {
      throw new Error(`requested character sheet ${kls} not in validated list`);
    }
    return new kls(data, this._index);
  }

  public async update<T extends CharacterMetadata>(
    app: App,
    path: string,
    kls: CharacterMetadataFactory<T>,
    updater: (character: InstanceType<typeof kls>) => InstanceType<typeof kls>,
  ): Promise<T> {
    const file = app.vault.getAbstractFileByPath(path);
    if (!(file instanceof TFile)) {
      throw new Error(`invalid character file ${path}`);
    }
    let updated: T | undefined;
    await app.fileManager.processFrontMatter(file, (frontmatter: any) => {
      updated = updater(
        this.forUpdates(kls, Object.freeze(Object.assign({}, frontmatter))),
      );

      // TODO: this isn't actually going to work right... for deletes
      Object.assign(frontmatter, updated.data);
    });
    // SAFETY: if we get here, we should have set updated.
    return updated!;
  }
}
