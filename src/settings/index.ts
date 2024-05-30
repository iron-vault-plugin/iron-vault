import { ClockFileAdapter } from "clocks/clock-file";
import Emittery from "emittery";
import Handlebars from "handlebars";
import { ProgressTrackFileAdapter, ProgressTrackInfo } from "tracks/progress";

export class IronVaultPluginSettings {
  advanceProgressTemplate: string =
    "> [!progress] [[{{trackPath}}|{{trackInfo.name}}]]: Marked {{steps}} progress ({{trackInfo.track.boxesFilled}} ![[progress-box-4.svg|15]] total)\n> Ticks: {{originalInfo.track.progress}} + {{ticks}} -> {{trackInfo.track.progress}}\n> Milestone: \n\n";
  createProgressTemplate: string =
    "> [!progress] New {{trackInfo.trackType}} track: [[{{trackPath}}|{{trackInfo.name}}]]\n> **Difficulty**: {{trackInfo.track.difficulty}}\n> **Additional details**: \n\n";
  advanceClockTemplate: string =
    "> [!progress] [[{{clockPath}}|{{clockInfo.name}}]] clock advanced\n>**Progress:** {{clockInfo.clock.progress}} out of {{clockInfo.clock.segments}} segments filled\n> \n> **Cause of Advance:**\n\n";
  createClockTemplate: string =
    "> [!progress] [[{{clockPath}}|{{clockInfo.name}}]] clock created\n>**Progress:** {{clockInfo.clock.progress}} out of {{clockInfo.clock.segments}} segments filled\n> \n> **Cause of Advance:**\n\n";
  oraclesFolder: string = "";

  defaultProgressTrackFolder: string = "Progress";
  defaultClockFolder: string = "Clocks";

  momentumResetTemplate: string =
    "> [!mechanics] {{character.name}} burned momentum: {{oldValue}} -> {{newValue}}\n\n";
  meterAdjTemplate: string =
    "> [!mechanics] {{character.name}} old {{measure.definition.label}}: {{measure.value}}; new {{measure.definition.label}}: {{newValue}}\n\n";

  /** Use the character system */
  useCharacterSystem: boolean = true;

  /** Set moves in mechanics blocks to be collapsed initially */
  collapseMoves: boolean = true;

  /** Hide "Hide mechanics" toggle */
  showMechanicsToggle: boolean = true;

  /** Completely hide all mechanics */
  hideMechanics: boolean = false;
  emitter: Emittery;

  constructor() {
    this.emitter = new Emittery();
    return new Proxy(this, {
      set<K extends keyof IronVaultPluginSettings>(
        target: IronVaultPluginSettings,
        key: K,
        newValue: IronVaultPluginSettings[K],
      ) {
        if (key === "emitter") {
          return true;
        }
        const oldValue = target[key];
        target[key] = newValue;
        target.emitter.emit("change", { key, oldValue, newValue });
        return true;
      },
    });
  }

  on<K extends keyof EVENT_TYPES>(
    event: K,
    listener: (params: EVENT_TYPES[K]) => void,
  ) {
    return this.emitter.on(event, listener);
  }

  once<K extends keyof EVENT_TYPES>(event: K) {
    return this.emitter.once(event);
  }

  off<K extends keyof EVENT_TYPES>(
    event: K,
    listener: (params: EVENT_TYPES[K]) => void,
  ) {
    return this.emitter.off(event, listener);
  }

  events<K extends keyof EVENT_TYPES>(event: K) {
    return this.emitter.events(event);
  }
}

export type EVENT_TYPES = {
  change: {
    key: keyof IronVaultPluginSettings;
    oldValue: IronVaultPluginSettings[keyof IronVaultPluginSettings];
    newValue: IronVaultPluginSettings[keyof IronVaultPluginSettings];
  };
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
): (
  settings: IronVaultPluginSettings,
) => (context: TEMPLATE_TYPES[K]) => string {
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
