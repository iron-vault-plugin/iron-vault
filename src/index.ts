import {
  Plugin,
  PluginSettingTab,
  Setting,
  type App,
  type Editor,
  type MarkdownFileInfo,
  type MarkdownView,
} from "obsidian";
import { registerOracleBlock } from "oracles/render";
import { pluginAsset } from "utils/obsidian";
import { IronswornMeasures } from "./character";
import { CharacterTracker } from "./character-tracker";
import { Datastore } from "./datastore";
import { runMoveCommand } from "./move-action";
import { registerMoveBlock } from "./move-block";
import { runOracleCommand } from "./oracles/command";
import { CustomSuggestModal } from "./utils/suggest";

// TODO: Remember to rename these classes and interfaces!

interface MyPluginSettings {
  mySetting: string;
}

const DEFAULT_SETTINGS: MyPluginSettings = {
  mySetting: "default",
};

export default class ForgedPlugin extends Plugin {
  settings: MyPluginSettings;
  datastore: Datastore;
  tracker: CharacterTracker;

  async onload(): Promise<void> {
    this.datastore = this.addChild(new Datastore(this.app));
    this.tracker = this.addChild(new CharacterTracker(this.app));
    await this.loadSettings();

    if (this.app.workspace.layoutReady) {
      const jsonPath = pluginAsset(this, "starforged.json");
      this.tracker.initialize();
      this.datastore.initialize(jsonPath);
    } else {
      this.app.workspace.onLayoutReady(() => {
        const jsonPath = pluginAsset(this, "starforged.json");
        this.tracker.initialize();
        this.datastore.initialize(jsonPath);
      });
    }

    window.ForgedAPI = { datastore: this.datastore, tracker: this.tracker };
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
      name: "Burn Mometnum",
      editorCallback: async (
        editor: Editor,
        _view: MarkdownView | MarkdownFileInfo,
      ) => {
        const [[path, character]] = this.tracker.characters.entries();
        const momentum = character.measures(IronswornMeasures).momentum;
        if (momentum > 0) {
          const resetValue = 2; // TODO: what is it
          await this.tracker.updateCharacter(path, (character) => {
            const measures = character.measures(IronswornMeasures);
            measures.momentum = resetValue;
            return true;
          });
          editor.replaceSelection(
            `old momentum: ${momentum}; new momentum: ${resetValue}`,
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
        const measures = character.measures(IronswornMeasures);
        const measure = await CustomSuggestModal.selectCustom(
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
        let updatedValue: number | undefined;
        await this.tracker.updateCharacter(path, (character) => {
          const measures = character.measures(IronswornMeasures);
          updatedValue = measures.value(measure.key) ?? 0 + modifier;
          measures.setValue(measure.key, updatedValue);

          return true;
        });
        editor.replaceSelection(
          `old ${measure.definition.label}: ${measure.value}; new ${measure.definition.label}: ${updatedValue}`,
        );
      },
    });

    // This adds a settings tab so the user can configure various aspects of the plugin
    this.addSettingTab(new SampleSettingTab(this.app, this));

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

class SampleSettingTab extends PluginSettingTab {
  plugin: ForgedPlugin;

  constructor(app: App, plugin: ForgedPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;

    containerEl.empty();

    new Setting(containerEl)
      .setName("Setting #1")
      .setDesc("It's a secret")
      .addText((text) =>
        text
          .setPlaceholder("Enter your secret")
          .setValue(this.plugin.settings.mySetting)
          .onChange(async (value) => {
            this.plugin.settings.mySetting = value;
            await this.plugin.saveSettings();
          }),
      );
  }
}
