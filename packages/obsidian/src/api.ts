import { CampaignDataContext } from "campaigns/context";
import { CharacterActionContext } from "characters/action-context";
import { IDataContext } from "datastore/data-context";
import {
  availableEntityTypes,
  generateEntityViaModal,
  promptForEntityType,
} from "entity/command";
import {
  EntityDescriptor,
  EntitySpec,
  NewEntityModalResults,
} from "entity/specs";
import { rootLogger, setLogLevel } from "logger";
import loglevel from "loglevel";
import { App, getLinkpath, parseLinktext } from "obsidian";
import { OracleRoller } from "oracles/roller";
import { ProgressIndex } from "tracks/indexer";
import {
  CharacterTracker,
  currentActiveCharacterForCampaign,
  promptForCampaignCharacter,
} from "./character-tracker";
import { Datastore } from "./datastore";
import IronVaultPlugin from "./index";
import { RollWrapper } from "./model/rolls";

function stripLinks(input: string): string {
  return input.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
}

export class IronVaultAPI {
  constructor(public readonly plugin: IronVaultPlugin) {}

  get datastore(): Datastore {
    return this.plugin.datastore;
  }

  get tracker(): CharacterTracker {
    return this.plugin.characters;
  }

  get progress(): ProgressIndex {
    return this.plugin.progressTracks;
  }

  get globalDataContext(): IDataContext {
    return this.plugin.datastore.dataContext;
  }

  /** Active campaign context  */
  get activeCampaignContext(): CampaignDataContext | undefined {
    return this.plugin.campaignManager.lastActiveCampaignContext();
  }

  /** A campaign data context if available, otherwise global. */
  get activeDataContext(): IDataContext {
    return this.activeCampaignContext ?? this.globalDataContext;
  }

  mustActiveCampaignContext(): CampaignDataContext {
    const context = this.activeCampaignContext;
    if (!context) {
      throw new Error("No active campaign context available.");
    }
    return context;
  }

  /** Prompt the user to select a character for the given campaign context.
   * @returns promise that resolves to CharacterActionContext for the selected character, or fails
   *   if the user cancels.
   */
  promptForCharacter(
    campaignContext: CampaignDataContext,
  ): Promise<CharacterActionContext> {
    return promptForCampaignCharacter(this.plugin, campaignContext);
  }

  /** Returns the currently active character for the given campaign context.
   * @param [campaignContext=undefined] - campaign context to get active character for, or undefined
   *   for the currently active campaign (if any)
   */
  currentActiveCharacterForCampaign(
    campaignContext: CampaignDataContext | undefined = undefined,
  ): CharacterActionContext | undefined {
    const campaign = campaignContext ?? this.activeCampaignContext;
    return (
      campaign && currentActiveCharacterForCampaign(this.plugin, campaign, true)
    );
  }

  /** Returns the available entity types for the given campaign context. */
  availableEntityTypes(
    campaignContext: CampaignDataContext = this.mustActiveCampaignContext(),
  ): [string, EntityDescriptor<EntitySpec>][] {
    return availableEntityTypes(campaignContext);
  }

  /** Get the entity descriptor for the given entity type. */
  getEntityDescriptor(
    entityType: string,
    campaignContext: CampaignDataContext = this.mustActiveCampaignContext(),
  ): EntityDescriptor<EntitySpec> | undefined {
    const entityTypes = this.availableEntityTypes(campaignContext);
    const found = entityTypes.find(([type]) => type === entityType);
    return found ? found[1] : undefined;
  }

  /** Prompts for an entity type and returns the entity descriptor for the selected entity type.
   *
   * @param campaignContext - the campaign context to use for available entity types. if not provided,
   *  the currently active campaign context is used. if no active campaign, an error is thrown.
   * @returns a promise that resolves to the selected entity descriptor.
   */
  promptForEntityType(
    campaignContext: CampaignDataContext = this.mustActiveCampaignContext(),
  ): Promise<EntityDescriptor<EntitySpec>> {
    return promptForEntityType(this.plugin, campaignContext);
  }

  /** Generates an entity.
   *
   * @param entityDesc - the entity descriptor to use for generating the entity, as returned by
   * `promptForEntityType` or `availableEntityTypes`. If not provided, {@link promptForEntityType}
   * will be called to prompt the user for an entity type.
   * @param campaignContext - the campaign context to use for generating the entity. if not provided,
   *  the currently active campaign context is used. if no active campaign, an error is thrown.
   * @returns a promise that resolves to the results of the entity generation modal.
   *
   * @remarks
   * This method will prompt the user to select an entity type if `entityDesc` is not provided.
   * It will then open a modal to generate the entity based on the selected type.
   *
   * @example <caption>Using a specific entity type</caption>
   * // Must be run within a SF campaign context
   * const ed = IronVaultAPI.getEntityDescriptor("sfPlanet");
   * const entity = await IronVaultAPI.generateEntity(ed);
   * for (const [k, v] of Object.entries(entity.entityProxy)) {
   *   console.log(k, "=", v.map((roll) => roll.simpleResult).join("; "));
   * }
   * // region = Expanse
   * // class = [Rocky World](datasworn:oracle_collection:starforged/planet/rocky)
   * // name = Latona
   * // atmosphere = None / thin
   * // observed_from_space = [Precursor Vault](datasworn:oracle_collection:starforged/precursor_vault) (orbital)
   * // settlements = None
   */
  async generateEntity(
    entityDesc: EntityDescriptor<EntitySpec> | undefined = undefined,
    campaignContext: CampaignDataContext = this.mustActiveCampaignContext(),
  ): Promise<NewEntityModalResults<EntitySpec>> {
    entityDesc ??= await this.promptForEntityType(campaignContext);
    return await generateEntityViaModal(
      this.plugin,
      campaignContext,
      entityDesc,
    );
  }

  public async roll(oracle: string): Promise<RollWrapper> {
    return new OracleRoller(this.plugin, this.activeDataContext.oracles).roll(
      oracle,
    );
  }

  public stripLinks(input: string): string {
    return stripLinks(input);
  }

  get logLevel(): loglevel.LogLevelDesc {
    return rootLogger.getLevel();
  }

  set logLevel(level: loglevel.LogLevelDesc) {
    setLogLevel(level);
  }

  setLogLevelFor(loggerName: string, level: loglevel.LogLevelDesc | null) {
    const logger = rootLogger.getLogger(loggerName);
    if (level == null) {
      logger.resetLevel();
    } else {
      logger.setLevel(level);
    }
  }

  parseLinkText = parseLinktext;

  getLinkpath = getLinkpath;
}

export const getAPI = (app?: App): IronVaultAPI | undefined => {
  if (app) return app.plugins.plugins["iron-vault"]?.api;
  else return window.IronVaultAPI;
};

export const isPluginEnabled = (app: App) =>
  app.plugins.enabledPlugins.has("iron-vault");
