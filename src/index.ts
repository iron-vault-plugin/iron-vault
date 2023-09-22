import {
  type App,
  type Editor,
  type MarkdownView,
  Notice,
  Plugin,
  PluginSettingTab,
  Setting,
  normalizePath,
} from "obsidian";
import { runMoveCommand } from "./move-action";
import { registerMoveBlock } from "./move-block";
import { Datastore } from "./datastore";
import CharacterTracker from "./character";
import { runOracleCommand } from "./oracles";

// Remember to rename these classes and interfaces!

interface MyPluginSettings {
  mySetting: string;
}

const DEFAULT_SETTINGS: MyPluginSettings = {
  mySetting: "default",
};

function pluginAsset(plug: Plugin, assetPath: string): string {
  return normalizePath(
    [plug.app.vault.configDir, "plugins", plug.manifest.id, assetPath].join(
      "/",
    ),
  );
}

export default class ForgedPlugin extends Plugin {
  settings: MyPluginSettings;
  datastore: Datastore;
  tracker: CharacterTracker;

  async onload(): Promise<void> {
    this.datastore = new Datastore(this.app);
    this.tracker = this.addChild(new CharacterTracker(this.app));

    if (this.app.workspace.layoutReady) {
      this.tracker.initialize();
    } else {
      this.app.workspace.onLayoutReady(() => {
        this.tracker.initialize();
      });
    }

    this.app.workspace.onLayoutReady(async () => {
      const jsonPath = pluginAsset(this, "starforged.json");
      await this.datastore.load(jsonPath);
    });

    await this.loadSettings();

    // This creates an icon in the left ribbon.
    const ribbonIconEl = this.addRibbonIcon(
      "dice",
      "Sample Plugin",
      (evt: MouseEvent) => {
        // Called when the user clicks the icon.
        new Notice("This is a notice!");
      },
    );
    // Perform additional things with the ribbon
    ribbonIconEl.addClass("my-plugin-ribbon-class");

    // This adds a status bar item to the bottom of the app. Does not work on mobile apps.
    const statusBarItemEl = this.addStatusBarItem();
    statusBarItemEl.setText("Status Bar Text");

    this.addCommand({
      id: "make-a-move",
      name: "Make a Move",
      editorCallback: async (editor: Editor, view: MarkdownView) => {
        await runMoveCommand(
          this.app,
          this.datastore,
          this.tracker,
          editor,
          view,
        );
      },
    });

    this.addCommand({
      id: "ask-the-oracle",
      name: "Ask the Oracle",
      editorCallback: async (editor: Editor, view: MarkdownView) => {
        await runOracleCommand(this.app, this.datastore, editor, view);
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
  }

  onunload() {}

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
