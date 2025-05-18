import Emittery from "emittery";
import IronVaultPlugin from "index";
import { rootLogger } from "logger";
import { normalizePath, TFile } from "obsidian";

const logger = rootLogger.getLogger("local-settings");

export class IronVaultPluginLocalSettings {
  #campaigns: Map<TFile, CampaignLocalSettings> = new Map();
  emitter?: Emittery<EVENT_TYPES>;

  constructor() {
    this.emitter = new Emittery();
  }

  forCampaign(file: TFile): CampaignLocalSettings {
    let existing = this.#campaigns.get(file);
    if (existing == null) {
      this.#campaigns.set(
        file,
        (existing = new CampaignLocalSettings(this, file)),
      );
    }
    return existing;
  }

  static dataPath(plugin: IronVaultPlugin) {
    return normalizePath(
      [
        plugin.app.vault.configDir,
        "plugins",
        plugin.manifest.id,
        "_localData.json",
      ].join("/"),
    );
  }

  async loadData(plugin: IronVaultPlugin): Promise<void> {
    const raw = await IronVaultPluginLocalSettings.loadDataRaw(plugin);

    const { vault } = plugin.app;

    for (const [path, config] of Object.entries(raw.campaigns ?? {})) {
      const file = vault.getFileByPath(path);
      if (!file) {
        logger.warn(
          "Local settings references campaign at path '%s', but that file does not exist.",
          path,
        );
        continue;
      }
      Object.assign(this.forCampaign(file), config);
    }
  }

  static async loadDataRaw(plugin: IronVaultPlugin) {
    const path = this.dataPath(plugin);
    try {
      if (!(await plugin.app.vault.adapter.exists(path))) {
        return {};
      }
      return JSON.parse(
        await plugin.app.vault.adapter.read(this.dataPath(plugin)),
      );
    } catch (e) {
      logger.warn("Failed to load local settings. Resetting to defaults...", e);
      return {};
    }
  }

  toJSON() {
    return {
      campaigns: Object.fromEntries(
        [...this.#campaigns.entries()].map(([campaignFile, settings]) => [
          campaignFile.path,
          settings,
        ]),
      ),
    };
  }

  async saveData(plugin: IronVaultPlugin) {
    return plugin.app.vault.adapter.write(
      IronVaultPluginLocalSettings.dataPath(plugin),
      JSON.stringify(this.toJSON(), null, 2),
    );
  }

  on<K extends keyof EVENT_TYPES>(
    event: K,
    listener: (params: EVENT_TYPES[K]) => void,
  ) {
    return this.emitter!.on(event, listener);
  }

  once<K extends keyof EVENT_TYPES>(event: K) {
    return this.emitter!.once(event);
  }

  off<K extends keyof EVENT_TYPES>(
    event: K,
    listener: (params: EVENT_TYPES[K]) => void,
  ) {
    return this.emitter!.off(event, listener);
  }

  events<K extends keyof EVENT_TYPES>(event: K) {
    return this.emitter!.events(event);
  }
}

type CHANGE_TYPES = {
  [K in keyof CampaignLocalSettings]: {
    campaignFile: TFile;
    key: K;
    oldValue: CampaignLocalSettings[K];
    newValue: CampaignLocalSettings[K];
  };
};

export type EVENT_TYPES = {
  change: CHANGE_TYPES[keyof CampaignLocalSettings];
};

/** Defines campaign-specific local settings. */
export class CampaignLocalSettings {
  /** Active character within a multi-character vault. */
  activeCharacter: string | undefined = undefined;

  /** Number of sides for the two challenge dice for action rolls. */
  actionRollChallengeDiceSides: [number, number] | undefined = undefined;

  constructor(parent: IronVaultPluginLocalSettings, campaignFile: TFile) {
    return new Proxy(this, {
      set<K extends keyof CampaignLocalSettings>(
        target: CampaignLocalSettings,
        key: K,
        newValue: CampaignLocalSettings[K],
      ) {
        const oldValue = target[key] as CampaignLocalSettings[K];
        target[key] = newValue;
        parent.emitter!.emit("change", {
          campaignFile,
          key: key,
          oldValue,
          newValue,
        } as CHANGE_TYPES[K]);
        return true;
      },
    });
  }
}
