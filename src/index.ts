import { addAssetToCharacter } from "characters/commands";
import { generateEntityCommand } from "entity/command";
import { IndexManager } from "indexer/manager";
import {
  Plugin,
  type Editor,
  type MarkdownFileInfo,
  type MarkdownView,
} from "obsidian";
import { ProgressContext } from "tracks/context";
import { ForgedAPI } from "./api";
import { CharacterIndexer, CharacterTracker } from "./character-tracker";
import * as meterCommands from "./characters/meter-commands";
import { Datastore } from "./datastore";
import registerMechanicsBlock from "./mechanics/mechanics-blocks";
import { runMoveCommand } from "./moves/action";
import { registerMoveBlock } from "./moves/block";
import { runOracleCommand } from "./oracles/command";
import { registerOracleBlock } from "./oracles/render";
import {
  DEFAULT_SETTINGS,
  ForgedPluginSettings,
  ForgedSettingTab,
} from "./settings/ui";
import { ClockIndex, ClockIndexer } from "./tracks/clock-file";
import {
  advanceClock,
  advanceProgressTrack,
  createProgressTrack,
} from "./tracks/commands";
import {
  ProgressIndex,
  ProgressIndexer,
  ProgressTrackSettings,
} from "./tracks/progress";
import { pluginAsset } from "./utils/obsidian";

export default class ForgedPlugin extends Plugin {
  settings!: ForgedPluginSettings;
  datastore!: Datastore;
  characters!: CharacterTracker;
  progressTrackSettings: ProgressTrackSettings = {
    generateTrackImage: (track) => `[[progress-track-${track.progress}.svg]]`,
  };
  progressIndex!: ProgressIndex;
  clockIndex!: ClockIndex;
  indexManager!: IndexManager;
  api!: ForgedAPI;

  private async initialize(): Promise<void> {
    await this.datastore.initialize();
    this.indexManager.initialize();
  }

  public assetFilePath(assetPath: string) {
    return pluginAsset(this, assetPath);
  }

  async onload(): Promise<void> {
    await this.loadSettings();

    this.datastore = this.addChild(new Datastore(this));
    this.characters = new CharacterTracker();
    this.progressIndex = new Map();
    this.clockIndex = new Map();
    this.indexManager = this.addChild(
      new IndexManager(this.app, this.datastore.index),
    );
    this.indexManager.registerHandler(
      new CharacterIndexer(
        this.characters,
        this.datastore,
        this.progressTrackSettings,
      ),
    );
    this.indexManager.registerHandler(
      new ProgressIndexer(this.progressIndex, this.progressTrackSettings),
    );
    this.indexManager.registerHandler(new ClockIndexer(this.clockIndex));

    if (this.app.workspace.layoutReady) {
      await this.initialize();
    } else {
      this.app.workspace.onLayoutReady(() => this.initialize());
    }

    window.ForgedAPI = this.api = new ForgedAPI(this);
    this.register(() => delete window.ForgedAPI);

    // This adds a status bar item to the bottom of the app. Does not work on mobile apps.
    // const statusBarItemEl = this.addStatusBarItem();
    // statusBarItemEl.setText("Status Bar Text");

    this.addCommand({
      id: "make-a-move",
      name: "Make a Move",
      icon: "zap",
      editorCallback: async (
        editor: Editor,
        view: MarkdownView | MarkdownFileInfo,
      ) => {
        // TODO: what if it is just a fileinfo?
        await runMoveCommand(
          this.app,
          this.datastore,
          new ProgressContext(this),
          this.characters,
          editor,
          view as MarkdownView,
          this.settings,
        );
      },
    });

    this.addCommand({
      id: "ask-the-oracle",
      name: "Ask the Oracle",
      icon: "help-circle",
      editorCallback: async (
        editor: Editor,
        view: MarkdownView | MarkdownFileInfo,
      ) => {
        await runOracleCommand(
          this.app,
          this.datastore,
          editor,
          view as MarkdownView,
        );
      },
    });

    this.addCommand({
      id: "burn-momentum",
      name: "Burn Momentum",
      editorCallback: (editor: Editor) =>
        meterCommands.burnMomentum(this, editor),
    });

    this.addCommand({
      id: "progress-create",
      name: "Progress Track: Create a Progress Track",
      editorCallback: (editor) => createProgressTrack(this, editor),
    });

    this.addCommand({
      id: "progress-advance",
      name: "Advance a Progress Track",
      editorCallback: async (editor, ctx) => {
        await advanceProgressTrack(
          this.app,
          this.settings,
          editor,
          ctx as MarkdownView,
          new ProgressContext(this),
        );
      },
    });

    this.addCommand({
      id: "clock-advance",
      name: "Advance a Clock",
      editorCallback: async (editor, ctx) => {
        await advanceClock(
          this.app,
          this.settings,
          editor,
          ctx as MarkdownView,
          this.clockIndex,
        );
      },
    });

    this.addCommand({
      id: "entity-gen",
      name: "Generate an entity",
      editorCallback: async (editor) => {
        await generateEntityCommand(this, editor);
      },
    });

    this.addCommand({
      id: "character-add-asset",
      name: "Add asset to character",
      editorCallback: async (editor, ctx) => {
        await addAssetToCharacter(this, editor, ctx as MarkdownView);
      },
    });

    this.addCommand({
      id: "take-meter",
      name: "Take on a Meter",
      editorCallback: async (editor: Editor) =>
        meterCommands.modifyMeterCommand(
          this,
          editor,
          "take",
          ({ value, definition: { max } }) => value < max,
          (measure) =>
            Array(measure.definition.max - measure.value)
              .fill(0)
              .map((_, i) => i + 1),
        ),
    });

    this.addCommand({
      id: "suffer-meter",
      name: "Suffer on a Meter",
      editorCallback: async (editor: Editor) =>
        meterCommands.modifyMeterCommand(
          this,
          editor,
          "suffer",
          ({ value, definition: { min } }) => value > min,
          (measure) =>
            Array(measure.value - measure.definition.min)
              .fill(0)
              .map((_, i) => -1 * (i + 1)),
        ),
    });

    // This adds a settings tab so the user can configure various aspects of the plugin
    this.addSettingTab(new ForgedSettingTab(this.app, this));

    registerMechanicsBlock(this);
    registerMoveBlock(this);
    registerOracleBlock(this, this.datastore);
  }

  onunload(): void {}

  async loadSettings(): Promise<void> {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }
}
