import Handlebars from "handlebars";
import { ClockFileAdapter } from "tracks/clock-file";
import { ProgressTrackFileAdapter, ProgressTrackInfo } from "tracks/progress";

export enum MoveBlockFormat {
  /** Use the original YAML format for generating action blocks. */
  YAML = "yaml",

  /** Use the new one-line move format */
  MoveLine = "move-line",

  /** The newer KDL mechanics format */
  Mechanics = "mechanics",
}

export interface ForgedPluginSettings
  extends Record<keyof TEMPLATE_TYPES, string> {
  oraclesFolder: string;
  momentumResetTemplate: string;
  meterAdjTemplate: string;

  /** Which format should the move block be rendered with? */
  moveBlockFormat: MoveBlockFormat;

  /** Use the character system */
  useCharacterSystem: boolean;

  /** Set moves in mechanics blocks to be collapsed initially */
  collapseMoves: boolean;

  /** Hide "Hide mechanics" toggle */
  showMechanicsToggle: boolean;
}

export const DEFAULT_SETTINGS: ForgedPluginSettings = {
  moveBlockFormat: MoveBlockFormat.Mechanics,
  useCharacterSystem: true,
  collapseMoves: true,
  showMechanicsToggle: true,
  oraclesFolder: "",
  momentumResetTemplate:
    "> [!mechanics] {{character.name}} burned momentum: {{oldValue}} -> {{newValue}}\n\n",
  meterAdjTemplate:
    "> [!mechanics] {{character.name}} old {{measure.definition.label}}: {{measure.value}}; new {{measure.definition.label}}: {{newValue}}\n\n",
  advanceProgressTemplate:
    "> [!progress] [[{{trackPath}}|{{trackInfo.name}}]]: Marked {{steps}} progress ({{trackInfo.track.boxesFilled}} ![[progress-box-4.svg|15]] total)\n> Ticks: {{originalInfo.track.progress}} + {{ticks}} -> {{trackInfo.track.progress}}\n> Milestone: \n\n",
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
  ticks: number;
  originalInfo: ProgressTrackInfo;
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
