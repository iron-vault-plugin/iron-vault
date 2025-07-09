import { CampaignDataContext } from "campaigns/context";
import { CharacterActionContext } from "characters/action-context";
import { IDataContext } from "datastore/data-context";
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
