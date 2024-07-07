import Emittery from "emittery";
import IronVaultPlugin from "index";
import { rootLogger } from "logger";
import { normalizePath } from "obsidian";

const logger = rootLogger.getLogger("local-settings");

export class IronVaultPluginLocalSettings {
  activeCharacter?: string;
  emitter?: Emittery;

  constructor() {
    this.emitter = new Emittery();
    return new Proxy(this, {
      set<K extends keyof IronVaultPluginLocalSettings>(
        target: IronVaultPluginLocalSettings,
        key: K,
        newValue: IronVaultPluginLocalSettings[K],
      ) {
        if (key === "emitter") {
          return true;
        }
        const oldValue = target[key];
        target[key] = newValue;
        target.emitter!.emit("change", { key, oldValue, newValue });
        return true;
      },
    });
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

  static async loadData(plugin: IronVaultPlugin) {
    const path = this.dataPath(plugin);
    if (!plugin.app.vault.adapter.exists(path)) {
      return {};
    }
    try {
      return JSON.parse(
        await plugin.app.vault.adapter.read(this.dataPath(plugin)),
      );
    } catch (e) {
      logger.warn("Failed to load local settings. Resetting to defaults...", e);
      return {};
    }
  }

  async saveData(plugin: IronVaultPlugin) {
    return plugin.app.vault.adapter.write(
      IronVaultPluginLocalSettings.dataPath(plugin),
      JSON.stringify(this, null, 2),
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

  reset() {
    const fresh = Object.assign({}, new IronVaultPluginLocalSettings());
    delete fresh.emitter;
    Object.assign(this, fresh);
  }
}

export type EVENT_TYPES = {
  change: {
    key: keyof IronVaultPluginLocalSettings;
    oldValue: IronVaultPluginLocalSettings[keyof IronVaultPluginLocalSettings];
    newValue: IronVaultPluginLocalSettings[keyof IronVaultPluginLocalSettings];
  };
};
