import Emittery from "emittery";

export class IronVaultPluginSettings {
  enableIronsworn: boolean = false;
  enableStarforged: boolean = true;
  defaultProgressTrackFolder: string = "Progress";
  defaultClockFolder: string = "Clocks";
  defaultCharactersFolder: string = "Characters";

  progressTrackTemplateFile: string = "";
  characterTemplateFile: string = "";
  clockTemplateFile: string = "";

  /** When true, prompt the user to roll their own dice for moves. */
  promptForRollsInMoves: boolean = false;

  /** When true, prompt the user to roll their own dice for oracles. */
  promptForRollsInOracles: boolean = false;

  /** Use the character system */
  useCharacterSystem: boolean = true;

  /** Set moves in mechanics blocks to be collapsed initially */
  collapseMoves: boolean = false;

  /** Hide "Hide mechanics" toggle */
  showMechanicsToggle: boolean = false;

  /** Completely hide all mechanics */
  hideMechanics: boolean = false;

  /** Automatically inline clocks and tracks in journal on creation. */
  inlineOnCreation: boolean = false;
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
