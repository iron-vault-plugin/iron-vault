import { CampaignTrackedEntities } from "campaigns/context";
import { CampaignFile } from "campaigns/entity";
import { determineCampaignContext } from "campaigns/manager";
import IronVaultPlugin from "index";
import { onlyValid } from "indexer/index-impl";
import {
  MarkdownFileInfo,
  MarkdownView,
  TFile,
  type CachedMetadata,
} from "obsidian";
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
  campaignContext: CampaignTrackedEntities,
): Promise<[string, CharacterContext]> {
  const characters = [...onlyValid(campaignContext.characters).entries()];
  if (!characters.length) {
    throw new MissingCharacterError("no valid characters found");
  }

  const localSettings = plugin.localSettings.forCampaign(
    campaignContext.campaign.file,
  );

  const [charPath] =
    characters.length === 1
      ? [characters[0][0]]
      : localSettings.activeCharacter &&
          !plugin.settings.alwaysPromptActiveCharacter &&
          // If active character isn't in this campaign, we need a new one!
          characters.find(
            ([charPath]) => charPath === localSettings.activeCharacter,
          )
        ? [localSettings.activeCharacter]
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

  localSettings.activeCharacter = charPath;
  await plugin.saveSettings();

  return [charPath, plugin.characters.get(charPath)!.unwrap()];
}

export async function promptForCharacter(
  plugin: IronVaultPlugin,
  campaignContext: CampaignTrackedEntities,
): Promise<string> {
  return (
    await CustomSuggestModal.select(
      plugin.app,
      [...onlyValid(campaignContext.characters)],
      ([, char]) => char.lens.name.get(char.character),
      undefined,
      "Pick active character",
    )
  )[0];
}

export async function pickActiveCharacter(
  plugin: IronVaultPlugin,
  view?: MarkdownView | MarkdownFileInfo,
) {
  const campaignContext = await determineCampaignContext(plugin, view);
  const charPath = await promptForCharacter(plugin, campaignContext);
  await setActiveCharacter(plugin, campaignContext.campaign, charPath);
}

export async function setActiveCharacter(
  plugin: IronVaultPlugin,
  campaign: CampaignFile,
  charPath: string,
) {
  plugin.localSettings.forCampaign(campaign.file).activeCharacter = charPath;
  await plugin.saveSettings();
}
