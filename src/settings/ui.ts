import Handlebars from "handlebars";
import ForgedPlugin from "index";
import { PluginSettingTab, Setting, type App } from "obsidian";
import { ClockFileAdapter } from "tracks/clock-file";
import { ProgressTrackFileAdapter, ProgressTrackInfo } from "tracks/progress";

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
export interface ForgedPluginSettings
  extends Record<keyof TEMPLATE_TYPES, string> {
  oraclesFolder: string;
  momentumResetTemplate: string;
  meterAdjTemplate: string;
}
export const DEFAULT_SETTINGS: ForgedPluginSettings = {
  oraclesFolder: "",
  momentumResetTemplate:
    "> [!mechanics] {{character.name}} burned momentum: {{oldValue}} -> {{newValue}}\n\n",
  meterAdjTemplate:
    "> [!mechanics] {{character.name}} old {{measure.definition.label}}: {{measure.value}}; new {{measure.definition.label}}: {{newValue}}\n\n",
  advanceProgressTemplate:
    "> [!progress] [[{{trackPath}}|{{trackInfo.name}}]], {{steps}} progress marked ({{trackInfo.track.boxesFilled}} ![[progress-box-4.svg|15]] total)\n> \n> Milestone: \n\n",
  createProgressTemplate:
    "> [!progress] New {{trackInfo.trackType}} track: [[{{trackPath}}|{{trackInfo.name}}]]\n> **Difficulty**: {{trackInfo.track.difficulty}}\n> **Additional details**: \n\n",
  advanceClockTemplate:
    "> [!progress] [[{{clockPath}}|{{clockInfo.name}}]] clock advanced\n>**Progress:** {{clockInfo.clock.progress}} out of {{clockInfo.clock.segments}} segments filled\n> \n> **Cause of Advance:**\n\n",
  createClockTemplate:
    "> [!progress] [[{{clockPath}}|{{clockInfo.name}}]] clock created\n>**Progress:** {{clockInfo.clock.progress}} out of {{clockInfo.clock.segments}} segments filled\n> \n> **Cause of Advance:**\n\n",
};

export type TEMPLATE_TYPES = {
  advanceProgressTemplate: AdvanceProgressTemplateParams;
  createProgressTemplate: CreateProgressTemplateParams;
  advanceClockTemplate: AdvanceClockTemplateParams;
  createClockTemplate: CreateClockTemplateParams;
};

export type AdvanceProgressTemplateParams = {
  trackPath: string;
  trackInfo: ProgressTrackInfo;
  steps: number;
};

export type CreateProgressTemplateParams = {
  trackPath: string;
  trackInfo: ProgressTrackFileAdapter;
};

function compileTemplate<K extends keyof TEMPLATE_TYPES>(
  key: K,
): (settings: ForgedPluginSettings) => (context: TEMPLATE_TYPES[K]) => string {
  return (settings) => (context) =>
    Handlebars.compile<TEMPLATE_TYPES[K]>(settings[key], {
      noEscape: true,
    })(context, { allowProtoPropertiesByDefault: true });
}

export const advanceProgressTemplate = compileTemplate(
  "advanceProgressTemplate",
);
export const createProgressTemplate = compileTemplate("createProgressTemplate");
export const advanceClockTemplate = compileTemplate("advanceClockTemplate");
export const createClockTemplate = compileTemplate("createClockTemplate");

export type AdvanceClockTemplateParams = {
  clockPath: string;
  clockInfo: ClockFileAdapter;
  ticks: number;
};

export type CreateClockTemplateParams = {
  clockPath: string;
  clockInfo: ClockFileAdapter;
};
