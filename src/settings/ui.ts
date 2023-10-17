import ForgedPlugin from "index";
import { PluginSettingTab, Setting, type App } from "obsidian";

export class ForgedSettingTab extends PluginSettingTab {
  plugin: ForgedPlugin;

  constructor(app: App, plugin: ForgedPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;

    containerEl.empty();

    new Setting(containerEl)
      .setName("Oracles folder")
      .setDesc("If specified, load oracles from this folder")
      .addText((text) =>
        text
          .setPlaceholder("Folder name")
          .setValue(this.plugin.settings.oraclesFolder)
          .onChange(async (value) => {
            this.plugin.settings.oraclesFolder = value;
            await this.plugin.saveSettings();
          }),
      );
  }
}
export interface ForgedPluginSettings {
  oraclesFolder: string;
}
export const DEFAULT_SETTINGS: ForgedPluginSettings = {
  oraclesFolder: "",
};
