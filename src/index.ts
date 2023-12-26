import Handlebars from "handlebars";
import {
  Plugin,
  type Editor,
  type MarkdownFileInfo,
  type MarkdownView,
} from "obsidian";
import { IronswornCharacterMetadata } from "./character";
import { CharacterTracker } from "./character-tracker";
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
import { pluginAsset } from "./utils/obsidian";
import { CustomSuggestModal } from "./utils/suggest";

export default class ForgedPlugin extends Plugin {
  settings: ForgedPluginSettings;
  datastore: Datastore;
  tracker: CharacterTracker;

  private initialize(): void {
    this.tracker.initialize();
    this.datastore.initialize();
  }

  public assetFilePath(assetPath: string) {
    return pluginAsset(this, assetPath);
  }

  async onload(): Promise<void> {
    await this.loadSettings();

    this.datastore = this.addChild(new Datastore(this));
    this.tracker = this.addChild(
      new CharacterTracker(this.app, this.datastore.index),
    );

    if (this.app.workspace.layoutReady) {
      this.initialize();
    } else {
      this.app.workspace.onLayoutReady(() => this.initialize());
    }

    window.ForgedAPI = {
      datastore: this.datastore,
      tracker: this.tracker,
      // formatOracleBlock,
      // dehydrateRoll,
    };
    this.register(() => delete window.ForgedAPI);

    // This adds a status bar item to the bottom of the app. Does not work on mobile apps.
    // const statusBarItemEl = this.addStatusBarItem();
    // statusBarItemEl.setText("Status Bar Text");

    this.addCommand({
      id: "make-a-move",
      name: "Make a Move",
      editorCallback: async (
        editor: Editor,
        view: MarkdownView | MarkdownFileInfo,
      ) => {
        // TODO: what if it is just a fileinfo?
        await runMoveCommand(
          this.app,
          this.datastore,
          this.tracker,
          editor,
          view as MarkdownView,
        );
      },
    });

    this.addCommand({
      id: "ask-the-oracle",
      name: "Ask the Oracle",
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
        const [[path, character]] = this.tracker.characters.entries();
        const sheet = character.as(IronswornCharacterMetadata);
        const oldValue = sheet.measures.momentum;
        if (oldValue > 0) {
          const updated = await this.tracker.updateCharacter(
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
      id: "take-meter",
      name: "Take on a Meter",
      editorCallback: async (
        editor: Editor,
        _view: MarkdownView | MarkdownFileInfo,
      ) => {
        // todo: multichar
        const [[path, character]] = this.tracker.characters.entries();
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
        const updated = await this.tracker.updateCharacter(
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
