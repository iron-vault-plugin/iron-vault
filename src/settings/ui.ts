import ForgedPlugin from "index";
import { PluginSettingTab, Setting, type App } from "obsidian";
import { ForgedPluginSettings } from "settings";

export class ForgedSettingTab extends PluginSettingTab {
  plugin: ForgedPlugin;

  constructor(app: App, plugin: ForgedPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  async updateSetting<K extends keyof ForgedPluginSettings>(
    key: K,
    value: ForgedPluginSettings[K],
  ) {
    this.plugin.settings[key] = value;
    await this.plugin.saveSettings();
  }

  display(): void {
    const { containerEl } = this;
    const { settings } = this.plugin;

    containerEl.empty();

    new Setting(containerEl)
      .setName("Oracles folder")
      .setDesc("If specified, load oracles from this folder")
      .addText((text) =>
        text
          .setPlaceholder("Folder name")
          .setValue(settings.oraclesFolder)
          .onChange((value) => this.updateSetting("oraclesFolder", value)),
      );

    new Setting(containerEl)
      .setName("Use character system")
      .setDesc(
        "If enabled (default), the plugin will look for an active character when making moves. If disabled, you will be prompted to supply appropriate values when needed.",
      )
      .addToggle((toggle) =>
        toggle
          .setValue(settings.useCharacterSystem)
          .onChange((value) => this.updateSetting("useCharacterSystem", value)),
      );
  }
}
