import Emittery from "emittery";

export class IronVaultPluginSettings {
  graphicalOracleDice: boolean = true;
  graphicalActionDice: boolean = true;
  actionDieColor: string = "#8f8f8f";
  challengeDie1Color: string = "#8b5cf5";
  challengeDie2Color: string = "#8b5cf5";
  oracleDiceColor: string = "#9d6910";
  cursedDieColor: string = "#017403";
  enableCursedDie: boolean = true;
  cursedDieSides: number = 10;
  alwaysPromptActiveCharacter: boolean = false;

  defaultProgressTrackFolder: string = "Progress";
  defaultClockFolder: string = "Clocks";
  defaultCharactersFolder: string = "Characters";
  defaultCampaignContentFolder: string = "Custom Content";

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

  /** Index homebrew content. */
  useHomebrew: boolean = false;

  /** Base path for homebrew content. */
  homebrewPath: string = "Homebrew";

  /** Datasworn version. This is a hidden setting representing the last known Datasworn version for the content. */
  dataswornVersion?: string;

  /** Whether to generate an actor block even in a single PC campaign. */
  alwaysRecordActor: boolean = false;

  /** Use the legacy oracle roller modal. */
  useLegacyRoller: boolean = false;

  /** Show the dice roller debug view. */
  diceRollerDebug: boolean = false;

  /** Automatically hide dice after X seconds. Leave 0 to disable. */
  diceHideAfterSecs: number = 0;

  /** Allow clicking through the dice. */
  diceAllowClickthrough: boolean = false;

  /** Whether to use new style move sidebar or revert to legacy move modal. */
  useLegacyMoveModal: boolean = false;

  emitter?: Emittery;

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
        target.emitter!.emit("change", { key, oldValue, newValue });
        return true;
      },
    });
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
    const fresh = Object.assign({}, new IronVaultPluginSettings());
    delete fresh.emitter;
    Object.assign(this, fresh);
  }
}

export type EVENT_TYPES = {
  change: {
    key: keyof IronVaultPluginSettings;
    oldValue: IronVaultPluginSettings[keyof IronVaultPluginSettings];
    newValue: IronVaultPluginSettings[keyof IronVaultPluginSettings];
  };
};
