import { type CachedMetadata } from "obsidian";
import { ProgressTrackSettings } from "tracks/progress";
import { updaterWithContext } from "utils/update";
import {
  CharacterLens,
  ValidatedCharacter,
  characterLens,
} from "./characters/lens";
import { Datastore } from "./datastore";
import { BaseIndexer } from "./indexer/indexer";
import { Either, Left, Right } from "./utils/either";

export class CharacterTracker implements ReadonlyMap<string, CharacterResult> {
  constructor(
    public readonly index: Map<string, CharacterResult> = new Map(),
  ) {}

  forEach(
    callbackfn: (
      value: CharacterResult,
      key: string,
      map: ReadonlyMap<string, CharacterResult>,
    ) => void,
    thisArg?: any,
  ): void {
    this.index.forEach(callbackfn, thisArg);
  }
  get(key: string): CharacterResult | undefined {
    return this.index.get(key);
  }
  has(key: string): boolean {
    return this.index.has(key);
  }
  get size(): number {
    return this.index.size;
  }
  entries(): IterableIterator<[string, CharacterResult]> {
    return this.index.entries();
  }
  keys(): IterableIterator<string> {
    return this.index.keys();
  }
  values(): IterableIterator<CharacterResult> {
    return this.index.values();
  }
  [Symbol.iterator](): IterableIterator<[string, CharacterResult]> {
    return this.index[Symbol.iterator]();
  }

  *validCharacterEntries(): Generator<[string, CharacterContext]> {
    for (const [key, val] of this.entries()) {
      if (val.isRight()) {
        yield [key, val.value];
      }
    }
  }

  activeCharacter(): [string, CharacterContext] {
    if (this.size == 0) {
      throw new Error("no valid characters found");
    } else if (this.size > 1) {
      throw new Error("we don't yet support multiple characters");
    }

    const [[key, val]] = this.entries();
    if (val.isLeft()) {
      throw new Error("character is invalid", { cause: val.error });
    }

    return [key, val.value];
  }
}

export class CharacterIndexer extends BaseIndexer<CharacterResult> {
  readonly id: string = "character";

  constructor(
    tracker: CharacterTracker,
    protected readonly dataStore: Datastore,
    protected readonly trackSettings: ProgressTrackSettings,
  ) {
    super(tracker.index);
  }

  processFile(
    path: string,
    cache: CachedMetadata,
  ): CharacterResult | undefined {
    if (cache.frontmatter == null) {
      throw new Error("missing frontmatter cache");
    }
    const { validater, lens } = characterLens(
      this.dataStore.ruleset,
      this.trackSettings,
    );
    try {
      const result = validater(cache.frontmatter);
      return Right.create(new CharacterContext(result, lens, validater));
    } catch (e) {
      return Left.create(
        e instanceof Error ? e : new Error("unexpected error", { cause: e }),
      );
    }
  }
}

// TODO: this type is really weird. should a validatedcharacter carry around all of the context
//   used to produce it here? Or should that be coming from the datastore as needed?
export type CharacterResult<E extends Error = Error> = Either<
  E,
  CharacterContext
>;

export class CharacterContext {
  constructor(
    public readonly character: ValidatedCharacter,
    public readonly lens: CharacterLens,
    public readonly validater: (data: unknown) => ValidatedCharacter,
  ) {}

  get updater() {
    return updaterWithContext<ValidatedCharacter, CharacterContext>(
      (data) => this.validater(data),
      (character) => character.raw,
      this,
    );
  }
}
