import Emittery from "emittery";
import IronVaultPlugin from "index";
import { normalizePath } from "obsidian";

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
    try {
      return JSON.parse(
        await plugin.app.vault.adapter.read(this.dataPath(plugin)),
      );
    } catch (e) {
      if (e instanceof Error && e.message.includes("ENOENT")) {
        return {};
      } else {
        throw e;
      }
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
