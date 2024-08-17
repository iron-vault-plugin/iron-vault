import { CampaignDataContext } from "campaigns/context";
import { CampaignFile } from "campaigns/entity";
import { CampaignManager } from "campaigns/manager";
import { CharacterActionContext } from "characters/action-context";
import IronVaultPlugin from "index";
import { onlyValid } from "indexer/index-impl";
import { TFile, type CachedMetadata } from "obsidian";
import { Left } from "utils/either";
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
import {
  BaseIndexer,
  IndexOf,
  IndexUpdate,
  UnexpectedIndexingError,
} from "./indexer/indexer";

export class CharacterError extends Error {}

export class MissingCharacterError extends CharacterError {}

export class MissingCampaignError extends CharacterError {}

export class CharacterIndexer extends BaseIndexer<
  CharacterContext,
  z.ZodError
> {
  readonly id = IronVaultKind.Character;

  constructor(protected readonly campaignManager: CampaignManager) {
    super();
  }

  processFile(
    file: TFile,
    cache: CachedMetadata,
  ): IndexUpdate<CharacterContext, z.ZodError> {
    const campaign = this.campaignManager.watchForReindex(file.path);
    if (campaign == null) {
      // TODO(@cwegrzyn): this should yield the real error, but then I have to update the stuff that expects a zod error
      return Left.create(new UnexpectedIndexingError("missing campaign"));
    }
    const context = this.campaignManager.campaignContextFor(campaign);
    const { validater, lens } = characterLens(context.ruleset);
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

export function currentActiveCharacterForCampaign(
  plugin: IronVaultPlugin,
  campaignContext: CampaignDataContext,
): CharacterActionContext | undefined {
  const characters = onlyValid(campaignContext.characters);
  if (characters.size === 0) {
    throw new MissingCharacterError("no valid characters found");
  }

  const localSettings = plugin.localSettings.forCampaign(
    campaignContext.campaign.file,
  );
  const activeCharacter =
    localSettings.activeCharacter != null
      ? characters.get(localSettings.activeCharacter)
      : undefined;

  const charContext: [string, CharacterContext] | undefined =
    characters.size === 1
      ? [...characters.entries()][0]
      : activeCharacter && !plugin.settings.alwaysPromptActiveCharacter
        ? [localSettings.activeCharacter!, activeCharacter]
        : undefined;

  return (
    charContext &&
    new CharacterActionContext(
      plugin.datastore,
      campaignContext,
      charContext[0],
      charContext[1],
    )
  );
}

/** Returns an ActionContext for current active character in a campaign, or prompts if no such active
 * character can be determined.
 */
export async function requireActiveCharacterForCampaign(
  plugin: IronVaultPlugin,
  campaignContext: CampaignDataContext,
): Promise<CharacterActionContext> {
  let activeCharacter = currentActiveCharacterForCampaign(
    plugin,
    campaignContext,
  );
  if (!activeCharacter) {
    activeCharacter = await promptForCampaignCharacter(plugin, campaignContext);
  }

  setActiveCharacter(
    plugin,
    campaignContext.campaign,
    activeCharacter.characterPath,
  );
  return activeCharacter;
}

/** Shows a suggest modal listing the current campaign characters. */
export async function promptForCampaignCharacter(
  plugin: IronVaultPlugin,
  campaignContext: CampaignDataContext,
): Promise<CharacterActionContext> {
  // TODO(@cwegrzyn): would be nice if this showed the current active character when one is available
  const [path, charCtx] = await CustomSuggestModal.select(
    plugin.app,
    [...onlyValid(campaignContext.characters)],
    ([, char]) => char.lens.name.get(char.character),
    undefined,
    "Pick active character",
  );
  return new CharacterActionContext(
    plugin.datastore,
    campaignContext,
    path,
    charCtx,
  );
}

/** Updates the active character for a campaign. */
export async function setActiveCharacter(
  plugin: IronVaultPlugin,
  campaign: CampaignFile,
  charPath: string,
) {
  const localSettings = plugin.localSettings.forCampaign(campaign.file);
  if (localSettings.activeCharacter !== charPath) {
    localSettings.activeCharacter = charPath;
    await plugin.saveSettings();
  }
}
