import { type CachedMetadata } from "obsidian";
import { updaterWithContext } from "utils/update";
import { z } from "zod";
import {
  CharacterLens,
  CharacterValidater,
  ValidatedCharacter,
  characterLens,
} from "./characters/lens";
import { Datastore } from "./datastore";
import { BaseIndexer, IndexOf, IndexUpdate } from "./indexer/indexer";

export class CharacterError extends Error {}

export class MissingCharacterError extends Error {}

export class InvalidCharacterError extends Error {}

export class CharacterIndexer extends BaseIndexer<
  CharacterContext,
  z.ZodError
> {
  readonly id: string = "character";

  constructor(protected readonly dataStore: Datastore) {
    super();
  }

  processFile(
    path: string,
    cache: CachedMetadata,
  ): IndexUpdate<CharacterContext, z.ZodError> {
    if (cache.frontmatter == null) {
      throw new Error("missing frontmatter cache");
    }
    const { validater, lens } = characterLens(this.dataStore.ruleset);
    return validater(cache.frontmatter).map(
      (character) => new CharacterContext(character, lens, validater),
    );
  }
}

export class CharacterContext {
  constructor(
    public readonly character: ValidatedCharacter,
    public readonly lens: CharacterLens,
    public readonly validater: CharacterValidater,
  ) {}

  get updater() {
    return updaterWithContext<ValidatedCharacter, CharacterContext>(
      (data) => this.validater(data).unwrap(),
      (character) => character.raw,
      this,
    );
  }
}

export type CharacterTracker = IndexOf<CharacterIndexer>;

export function activeCharacter(
  characters: CharacterTracker,
): [string, CharacterContext] {
  if (characters.size == 0) {
    throw new MissingCharacterError("no valid characters found");
  } else if (characters.size > 1) {
    throw new MissingCharacterError("we don't yet support multiple characters");
  }

  const [[key, val]] = characters.entries();
  if (val.isLeft()) {
    throw val.error;
  }

  return [key, val.value];
}
