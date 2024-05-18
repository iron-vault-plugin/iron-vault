import { addAssetToCharacter } from "characters/commands";
import { generateEntityCommand } from "entity/command";
import { IndexManager } from "indexer/manager";
import { runMoveCommand } from "moves/action";
import {
  Plugin,
  type Editor,
  type MarkdownFileInfo,
  type MarkdownView,
} from "obsidian";
import { DEFAULT_SETTINGS, ForgedPluginSettings } from "settings";
import { ProgressContext } from "tracks/context";
import { ForgedAPI } from "./api";
import { CharacterIndexer, CharacterTracker } from "./character-tracker";
import * as meterCommands from "./characters/meter-commands";
import { Datastore } from "./datastore";
import registerMechanicsBlock from "./mechanics/mechanics-blocks";
import { registerMoveBlock } from "./moves/block";
import { runOracleCommand } from "./oracles/command";
import { registerOracleBlock } from "./oracles/render";
import { ForgedSettingTab } from "./settings/ui";
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
import { SidebarView, VIEW_TYPE } from "sidebar/sidebar-view";
import installMoveLinkHandler from "moves/link-override";
import installOracleLinkHandler from "oracles/link-override";
import { OracleModal } from "oracles/oracle-modal";
import { MoveModal } from "moves/move-modal";
import { ViewPlugin, ViewUpdate } from "@codemirror/view";

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
    await this.initLeaf();
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
    installMoveLinkHandler(this);
    installOracleLinkHandler(this);
    this.installIdLinkHandler(this);

    this.registerView(VIEW_TYPE, (leaf) => new SidebarView(leaf, this));
    this.addRibbonIcon("dice", "Forged", () => {
      return this.activateView();
    });
    // This adds a status bar item to the bottom of the app. Does not work on mobile apps.
    // const statusBarItemEl = this.addStatusBarItem();
    // statusBarItemEl.setText("Status Bar Text");

    this.addCommand({
      id: "make-a-move",
      name: "Make a Move",
      icon: "zap",
      editorCallback: (editor: Editor, view: MarkdownView | MarkdownFileInfo) =>
        // TODO: what if view is just a fileinfo?
        runMoveCommand(this, editor, view as MarkdownView),
    });

    this.addCommand({
      id: "ask-the-oracle",
      name: "Ask the Oracle",
      icon: "help-circle",
      editorCallback: (editor: Editor, view: MarkdownView | MarkdownFileInfo) =>
        runOracleCommand(
          this.app,
          this.datastore,
          editor,
          view as MarkdownView,
        ),
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
          ({ value, definition: { max } }) =>
            value === undefined || value < max,
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
          ({ value, definition: { min } }) =>
            value === undefined || value > min,
          (measure) =>
            Array(measure.value - measure.definition.min)
              .fill(0)
              .map((_, i) => -1 * (i + 1)),
        ),
    });

    this.addCommand({
      id: "toggle-mechanics",
      name: "Toggle Displaying Mechanics",
      editorCallback: async (editor: Editor) => {
        editor.containerEl.ownerDocument.body.classList.toggle(
          "collapse-forged-mechanics",
        );
      },
    });

    // This adds a settings tab so the user can configure various aspects of the plugin
    this.addSettingTab(new ForgedSettingTab(this.app, this));

    registerMoveBlock(this);
    registerOracleBlock(this, this.datastore);
    registerMechanicsBlock(this);
  }

  async activateView() {
    const { workspace } = this.app;
    const leaf = await this.initLeaf();
    leaf && workspace.revealLeaf(leaf);
  }

  async initLeaf() {
    for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE)) {
      return leaf;
    }
    const leaf = this.app.workspace.getRightLeaf(false);
    await leaf?.setViewState({
      type: VIEW_TYPE,
    });
    return leaf;
  }

  onunload(): void {}

  async loadSettings(): Promise<void> {
    const settings = Object.assign(
      {},
      DEFAULT_SETTINGS,
      await this.loadData(),
      // Remove unused old variables
      { moveBlockFormat: undefined },
    );
    this.settings = settings;
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  installIdLinkHandler(plugin: ForgedPlugin) {
    const handler = (ev: MouseEvent) => {
      if (
        !(ev.target instanceof HTMLAnchorElement) ||
        ev.target.href !== "app://obsidian.md/index.html#"
      )
        return;
      const editor = plugin.app.workspace.activeEditor?.editor;
      if (editor) {
        const token = editor.getClickableTokenAt(editor.posAtMouse(ev));
        if (token && token.text.toLowerCase().startsWith("id:")) {
          ev.stopPropagation();
          ev.preventDefault();
          const id = token.text
            .slice("id:".length)
            .replace(/\s*/g, "")
            .toLowerCase();
          const oracle = plugin.datastore.oracles.get(id);
          const move =
            !oracle &&
            plugin.datastore.moves.find(
              (m) =>
                m._id === id || m.name.replace(/\s*/g, "").toLowerCase() === id,
            );
          if (oracle) {
            new OracleModal(plugin.app, plugin, oracle).open();
          } else if (move) {
            new MoveModal(plugin.app, plugin, move).open();
          }
        }
      }
    };
    const cmPlugin = ViewPlugin.fromClass(
      class LinkOverride {
        update(update: ViewUpdate) {
          const el = update.view.contentDOM;
          el.removeEventListener("click", handler);
          el.addEventListener("click", handler);
          plugin.register(() => el.removeEventListener("click", handler));
        }
      },
    );
    plugin.registerEditorExtension([cmPlugin]);
    plugin.app.workspace.updateOptions();
    plugin.registerMarkdownPostProcessor((el) => {
      el.querySelectorAll("a").forEach((a) => {
        if (a.href.startsWith("id:")) {
          const id = a.href
            .slice("id:".length)
            .replace(/\s*/g, "")
            .toLowerCase();
          const oracle = plugin.datastore.oracles.get(id);
          const move =
            !oracle &&
            plugin.datastore.moves.find(
              (m) =>
                m._id === id || m.name.replace(/\s*/g, "").toLowerCase() === id,
            );
          const handler = (ev: MouseEvent) => {
            ev.stopPropagation();
            ev.preventDefault();
            if (oracle) {
              new OracleModal(plugin.app, plugin, oracle).open();
            } else if (move) {
              new MoveModal(plugin.app, plugin, move).open();
            }
          };
          a.addEventListener("click", handler);
          plugin.register(() => a.removeEventListener("click", handler));
        }
      });
    });
  }
}
