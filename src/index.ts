import { generateEntityCommand } from "entity/command";
import Handlebars from "handlebars";
import { IndexManager } from "indexer/manager";
import {
  Plugin,
  type Editor,
  type MarkdownFileInfo,
  type MarkdownView,
} from "obsidian";
import { ForgedAPI } from "./api";
import { IronswornCharacterMetadata } from "./character";
import { CharacterIndexer, CharacterTracker } from "./character-tracker";
import { Datastore } from "./datastore";
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
import { CustomSuggestModal } from "./utils/suggest";

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

  private initialize(): void {
    this.indexManager.initialize();
    this.datastore.initialize();
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
      new CharacterIndexer(this.characters, this.datastore.index),
    );
    this.indexManager.registerHandler(
      new ProgressIndexer(this.progressIndex, this.progressTrackSettings),
    );
    this.indexManager.registerHandler(new ClockIndexer(this.clockIndex));

    if (this.app.workspace.layoutReady) {
      this.initialize();
    } else {
      this.app.workspace.onLayoutReady(() => this.initialize());
    }

    window.ForgedAPI = this.api = new ForgedAPI(
      this.datastore,
      this.characters,
      this.progressIndex,
    );
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
          this.progressIndex,
          this.characters,
          editor,
          view as MarkdownView,
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
      editorCallback: async (
        editor: Editor,
        _view: MarkdownView | MarkdownFileInfo,
      ) => {
        const [[path, character]] = this.characters.entries();
        const sheet = character.as(IronswornCharacterMetadata);
        const oldValue = sheet.measures.momentum;
        if (oldValue > 0) {
          const updated = await character.update(
            this.app,
            path,
            IronswornCharacterMetadata,
            (character) => {
              return character.measures.set(
                "momentum",
                character.momentumReset,
              );
            },
          );
          const template = Handlebars.compile(
            this.settings.momentumResetTemplate,
            { noEscape: true },
          );
          editor.replaceSelection(
            template({
              character: { name: sheet.name },
              oldValue,
              newValue: updated.measures.momentum,
            }),
          );
        }
      },
    });

    this.addCommand({
      id: "progress-create",
      name: "Progress Track: Create a Progress Track",
      editorCallback: async (editor, ctx) => {
        await createProgressTrack(
          this,
          editor,
          // ctx as MarkdownView,
        );
      },
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
          this.progressIndex,
          this.progressTrackSettings,
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
      editorCallback: async (editor, ctx) => {
        await generateEntityCommand(this, editor);
      },
    });

    this.addCommand({
      id: "take-meter",
      name: "Take on a Meter",
      editorCallback: async (
        editor: Editor,
        _view: MarkdownView | MarkdownFileInfo,
      ) => {
        // todo: multichar
        const [[path, character]] = this.characters.entries();
        const sheet = character.as(IronswornCharacterMetadata);
        const measures = sheet.measures;
        const measure = await CustomSuggestModal.select(
          this.app,
          measures.entries(),
          ({ key, value, definition }) => definition.label,
          (match, el) => {
            el.createEl("small", { text: `${match.item.value}` });
          },
        );
        const modifier = await CustomSuggestModal.select(
          this.app,
          [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
          (n) => n.toString(),
        );
        const updated = await character.update(
          this.app,
          path,
          IronswornCharacterMetadata,
          (character) => {
            const measures = character.measures;
            const newValue = (measures.value(measure.key) ?? 0) + modifier;
            return measures.set(measure.key, newValue);
          },
        );
        const template = Handlebars.compile(this.settings.meterAdjTemplate, {
          noEscape: true,
        });
        editor.replaceSelection(
          template({
            character: { name: sheet.name },
            measure,
            newValue: updated.measures.value(measure.key),
          }),
        );
      },
    });

    // This adds a settings tab so the user can configure various aspects of the plugin
    this.addSettingTab(new ForgedSettingTab(this.app, this));

    // If the plugin hooks up any global DOM events (on parts of the app that doesn't belong to this plugin)
    // Using this function will automatically remove the event listener when this plugin is disabled.
    // this.registerDomEvent(document, "click", (evt: MouseEvent) => {
    //   console.log("click", evt);
    // });

    // When registering intervals, this function will automatically clear the interval when the plugin is disabled.
    // this.registerInterval(
    //   window.setInterval(() => console.log("setInterval"), 5 * 60 * 1000),
    // );
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
