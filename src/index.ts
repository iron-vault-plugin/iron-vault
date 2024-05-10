import { addAssetToCharacter } from "characters/commands";
import { meterLenses, momentumOps } from "characters/lens";
import { generateEntityCommand } from "entity/command";
import Handlebars from "handlebars";
import { IndexManager } from "indexer/manager";
import {
  Plugin,
  type Editor,
  type MarkdownFileInfo,
  type MarkdownView,
} from "obsidian";
import { ConditionMeterDefinition } from "rules/ruleset";
import { ProgressContext } from "tracks/context";
import { updating } from "utils/lens";
import { ForgedAPI } from "./api";
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
import { pluginAsset, vaultProcess } from "./utils/obsidian";
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
      editorCallback: async (
        editor: Editor,
        _view: MarkdownView | MarkdownFileInfo,
      ) => {
        const [path, charContext] = this.characters.activeCharacter();
        const { lens, character } = charContext;
        const oldValue = lens.momentum.get(character);
        if (oldValue > 0) {
          // TODO: is the move here to straight-up throw an error if there isn't enough momentum?
          const updated = await charContext.updater(
            vaultProcess(this.app, path),
            (character, { lens }) => {
              return momentumOps(lens).reset(character);
            },
          );
          const template = Handlebars.compile(
            this.settings.momentumResetTemplate,
            { noEscape: true },
          );
          editor.replaceSelection(
            template({
              character: { name: lens.name.get(updated) },
              oldValue,
              newValue: lens.momentum.get(updated),
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
      editorCallback: async (editor, ctx) => {
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

    const modifyMeterCommand = async (
      editor: Editor,
      verb: string,
      meterFilter: (meter: {
        value: number;
        definition: ConditionMeterDefinition;
      }) => boolean,
      allowableValues: (measure: {
        value: number;
        definition: ConditionMeterDefinition;
      }) => number[],
    ) => {
      // todo: multichar
      const [path, context] = this.characters.activeCharacter();
      const { character, lens } = context;
      const measure = await CustomSuggestModal.select(
        this.app,
        Object.values(meterLenses(lens))
          .map(({ key, definition, lens }) => ({
            key,
            definition,
            lens,
            value: lens.get(character),
          }))
          .filter(meterFilter),
        ({ definition }) => definition.label,
        (match, el) => {
          el.createEl("small", { text: `${match.item.value}` });
        },
      );
      const modifier = await CustomSuggestModal.select(
        this.app,
        allowableValues(measure),
        (n) => n.toString(),
        undefined,
        `${verb} ${measure.definition.label}`,
      );
      const updated = await context.updater(
        vaultProcess(this.app, path),
        (character) => {
          return updating(
            measure.lens,
            (startVal) => startVal + modifier,
          )(character);
        },
      );
      const template = Handlebars.compile(this.settings.meterAdjTemplate, {
        noEscape: true,
      });
      editor.replaceSelection(
        template({
          character: { name: lens.name.get(character) },
          measure,
          newValue: measure.lens.get(updated),
        }),
      );
    };

    this.addCommand({
      id: "take-meter",
      name: "Take on a Meter",
      editorCallback: async (
        editor: Editor,
        _view: MarkdownView | MarkdownFileInfo,
      ) =>
        modifyMeterCommand(
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
      editorCallback: async (
        editor: Editor,
        _view: MarkdownView | MarkdownFileInfo,
      ) =>
        modifyMeterCommand(
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
