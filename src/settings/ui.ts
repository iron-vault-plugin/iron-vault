import Handlebars from "handlebars";
import ForgedPlugin from "index";
import { PluginSettingTab, Setting, type App } from "obsidian";
import { ClockFileAdapter } from "tracks/clock-file";
import { ProgressTrackInfo } from "tracks/progress";

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
  momentumResetTemplate: string;
  meterAdjTemplate: string;
  advanceProgressTemplate: string;
  advanceClockTemplate: string;
}
export const DEFAULT_SETTINGS: ForgedPluginSettings = {
  oraclesFolder: "",
  momentumResetTemplate:
    "> [!mechanics] {{character.name}} burned momentum: {{oldValue}} -> {{newValue}}\n\n",
  meterAdjTemplate:
    "> [!mechanics] {{character.name}} old {{measure.definition.label}}: {{measure.value}}; new {{measure.definition.label}}: {{newValue}}\n\n",
  advanceProgressTemplate:
    "> [!progress] [[{{trackPath}}|{{trackInfo.name}}]], {{steps}} progress marked ({{trackInfo.track.boxesFilled}} ![[progress-box-4.svg|15]] total)\n> \n> Milestone: \n\n",
  advanceClockTemplate:
    "> [!progress] [[{{clockPath}}|{{clockInfo.name}}]] clock advanced\n>**Progress:** {{clockInfo.clock.progress}} out of {{clockInfo.clock.segments}} segments filled\n> \n> **Cause of Advance:**\n\n",
};

export type AdvanceProgressTemplateParams = {
  trackPath: string;
  trackInfo: ProgressTrackInfo;
  steps: number;
};

export function advanceProgressTemplate(
  settings: ForgedPluginSettings,
): (context: AdvanceProgressTemplateParams) => string {
  return (context) =>
    Handlebars.compile<AdvanceProgressTemplateParams>(
      settings.advanceProgressTemplate,
      {
        noEscape: true,
      },
    )(context, { allowProtoPropertiesByDefault: true });
}

export type AdvanceClockTemplateParams = {
  clockPath: string;
  clockInfo: ClockFileAdapter;
  ticks: number;
};

export function advanceClockTemplate(
  settings: ForgedPluginSettings,
): (context: AdvanceClockTemplateParams) => string {
  return (context) =>
    Handlebars.compile<AdvanceClockTemplateParams>(
      settings.advanceClockTemplate,
      {
        noEscape: true,
      },
    )(context, { allowProtoPropertiesByDefault: true });
}
