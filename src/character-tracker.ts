import IronVaultPlugin from "index";
import { onlyValid } from "indexer/index-impl";
import { TFile, type CachedMetadata } from "obsidian";
import { Right } from "utils/either";
import { CustomSuggestModal } from "utils/suggest";
import { updaterWithContext } from "utils/update";
import { z } from "zod";
import {
  CharacterLens,
  CharacterValidater,
  ValidatedCharacter,
  characterLens,
} from "./characters/lens";
import { IronVaultKind } from "./constants";
import { Datastore } from "./datastore";
import { BaseIndexer, IndexOf, IndexUpdate } from "./indexer/indexer";

export class CharacterError extends Error {}

export class MissingCharacterError extends Error {}

export class InvalidCharacterError extends Error {}

export class CharacterIndexer extends BaseIndexer<
  CharacterContext,
  z.ZodError
> {
  readonly id = IronVaultKind.Character;

  constructor(protected readonly dataStore: Datastore) {
    super();
  }

  processFile(
    file: TFile,
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

export async function activeCharacter(
  plugin: IronVaultPlugin,
): Promise<[string, CharacterContext]> {
  const characters = [...onlyValid(plugin.characters).entries()];
  if (!characters.length) {
    throw new MissingCharacterError("no valid characters found");
  }

  const [charPath] =
    characters.length === 1
      ? [characters[0][0]]
      : plugin.localSettings.activeCharacter &&
          !plugin.settings.alwaysPromptActiveCharacter
        ? [plugin.localSettings.activeCharacter]
        : await CustomSuggestModal.select(
            plugin.app,
            characters,
            ([, char]) => char.lens.name.get(char.character),
            undefined,
            "Pick active character",
          );

  if (!charPath) {
    throw new MissingCharacterError("no valid characters found");
  }

  plugin.localSettings.activeCharacter = charPath;
  await plugin.saveSettings();

  return [charPath, plugin.characters.get(charPath)!.unwrap()] as [
    string,
    CharacterContext,
  ];
}

export async function setActiveCharacter(
  plugin: IronVaultPlugin,
  charPath?: string,
) {
  const newCharPath =
    charPath ??
    (
      await CustomSuggestModal.select(
        plugin.app,
        [...plugin.characters]
          .filter((x) => x[1].isRight())
          .map(
            ([key, val]) =>
              [key, (val as Right<CharacterContext>).value] as [
                string,
                CharacterContext,
              ],
          ),
        ([, char]) => char.lens.name.get(char.character),
        undefined,
        "Pick active character",
      )
    )[0];
  plugin.localSettings.activeCharacter = newCharPath;
  await plugin.saveSettings();
}
