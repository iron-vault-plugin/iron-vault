import { ViewPlugin, ViewUpdate } from "@codemirror/view";
import { determineCharacterActionContext } from "characters/action-context";
import registerCharacterBlock from "characters/character-block";
import { addAssetToCharacter, createNewCharacter } from "characters/commands";
import registerClockBlock from "clocks/clock-block";
import { advanceClock, createClock } from "clocks/commands";
import { generateEntityCommand } from "entity/command";
import { IndexManager } from "indexer/manager";
import { runMoveCommand } from "moves/action";
import installMoveLinkHandler from "moves/link-override";
import { MoveModal } from "moves/move-modal";
import {
  Plugin,
  type Editor,
  type MarkdownFileInfo,
  type MarkdownView,
} from "obsidian";
import installOracleLinkHandler from "oracles/link-override";
import { OracleModal } from "oracles/oracle-modal";
import { IronVaultPluginSettings } from "settings";
import registerSidebarBlocks from "sidebar/sidebar-block";
import { SidebarView, VIEW_TYPE } from "sidebar/sidebar-view";
import { ProgressContext } from "tracks/context";
import { ProgressIndex, ProgressIndexer } from "tracks/indexer";
import registerTrackBlock from "tracks/track-block";
import { IronVaultAPI } from "./api";
import { CharacterIndexer, CharacterTracker } from "./character-tracker";
import * as meterCommands from "./characters/meter-commands";
import { ClockIndex, ClockIndexer } from "./clocks/clock-file";
import { Datastore } from "./datastore";
import registerMechanicsBlock from "./mechanics/mechanics-blocks";
import { registerMoveBlock } from "./moves/block";
import { runOracleCommand } from "./oracles/command";
import { registerOracleBlock } from "./oracles/render";
import { IronVaultSettingTab } from "./settings/ui";
import { advanceProgressTrack, createProgressTrack } from "./tracks/commands";
import { pluginAsset } from "./utils/obsidian";
import installAssetLinkHandler from "tracks/link-override";
import { AssetModal } from "tracks/asset-modal";

export default class IronVaultPlugin extends Plugin {
  settings!: IronVaultPluginSettings;
  datastore!: Datastore;
  // characters!: CharacterTracker;
  // progressIndex!: ProgressIndex;
  // clockIndex!: ClockIndex;
  characterIndexer!: CharacterIndexer;
  progressIndexer!: ProgressIndexer;
  clockIndexer!: ClockIndexer;
  indexManager!: IndexManager;
  api!: IronVaultAPI;

  private async initialize(): Promise<void> {
    await this.datastore.initialize();
    this.indexManager.initialize();
    await this.initLeaf();
  }

  public assetFilePath(assetPath: string) {
    return pluginAsset(this, assetPath);
  }

  get characters(): CharacterTracker {
    return this.characterIndexer.index;
  }

  get clockIndex(): ClockIndex {
    return this.clockIndexer.index;
  }

  get progressIndex(): ProgressIndex {
    return this.progressIndexer.index;
  }

  async onload(): Promise<void> {
    await this.loadSettings();

    this.datastore = this.addChild(new Datastore(this));
    this.indexManager = this.addChild(new IndexManager(this.app));
    this.indexManager.registerHandler(
      (this.characterIndexer = new CharacterIndexer(this.datastore)),
    );
    this.indexManager.registerHandler(
      (this.progressIndexer = new ProgressIndexer()),
    );
    this.indexManager.registerHandler((this.clockIndexer = new ClockIndexer()));

    if (this.app.workspace.layoutReady) {
      await this.initialize();
    } else {
      this.app.workspace.onLayoutReady(() => this.initialize());
    }

    window.IronVaultAPI = this.api = new IronVaultAPI(this);
    this.register(() => delete window.IronVaultAPI);
    installMoveLinkHandler(this);
    installOracleLinkHandler(this);
    installAssetLinkHandler(this);
    this.installIdLinkHandler(this);

    this.registerView(VIEW_TYPE, (leaf) => new SidebarView(leaf, this));
    this.addRibbonIcon("dice", "Iron Vault", () => {
      return this.activateView();
    });
    // This adds a status bar item to the bottom of the app. Does not work on mobile apps.
    // const statusBarItemEl = this.addStatusBarItem();
    // statusBarItemEl.setText("Status Bar Text");

    this.addCommand({
      id: "make-a-move",
      name: "Make a move",
      icon: "zap",
      editorCallback: (editor: Editor, view: MarkdownView | MarkdownFileInfo) =>
        // TODO: what if view is just a fileinfo?
        runMoveCommand(this, editor, view as MarkdownView),
    });

    this.addCommand({
      id: "ask-the-oracle",
      name: "Ask the Oracle",
      icon: "message-circle-question",
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
      name: "Burn momentum",
      icon: "flame",
      editorCallback: (editor: Editor) =>
        meterCommands.burnMomentum(this, editor),
    });

    /*
     * PROGRESS TRACKS
     */

    this.addCommand({
      id: "progress-create",
      name: "Progress: Create a progress track",
      icon: "square-pen",
      editorCallback: (editor) => createProgressTrack(this, editor),
    });

    this.addCommand({
      id: "progress-advance",
      name: "Progress: Advance a progress track",
      icon: "chevrons-right",
      editorCallback: async (editor, ctx) => {
        const actionContext = await determineCharacterActionContext(this);
        if (!actionContext) return;
        await advanceProgressTrack(
          this.app,
          this.settings,
          editor,
          ctx as MarkdownView,
          new ProgressContext(this, actionContext),
        );
      },
    });

    /*
     * CLOCKS
     */

    this.addCommand({
      id: "clock-create",
      name: "Clock: Create a clock",
      icon: "alarm-clock",
      editorCallback: (editor) => createClock(this, editor),
    });

    this.addCommand({
      id: "clock-advance",
      name: "Clock: Advance a clock",
      icon: "alarm-clock-plus",
      editorCallback: (editor, ctx) =>
        advanceClock(
          this.app,
          this.settings,
          editor,
          ctx as MarkdownView,
          this.clockIndex,
        ),
    });

    this.addCommand({
      id: "entity-gen",
      name: "Generate an entity",
      icon: "package-plus",
      editorCallback: async (editor) => {
        await generateEntityCommand(this, editor);
      },
    });

    this.addCommand({
      id: "character-add-asset",
      name: "Add asset to character",
      icon: "gem",
      editorCallback: async (editor, ctx) => {
        await addAssetToCharacter(this, editor, ctx as MarkdownView);
      },
    });

    this.addCommand({
      id: "take-meter",
      name: "Take on a meter",
      icon: "trending-up",
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
      name: "Suffer on a meter",
      icon: "trending-down",
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
      name: "Toggle displaying mechanics",
      icon: "eye-off",
      editorCallback: async (_editor: Editor) => {
        this.settings.hideMechanics = !this.settings.hideMechanics;
      },
    });

    this.addCommand({
      id: "character-create",
      name: "Create new character",
      callback: () => createNewCharacter(this),
    });

    // This adds a settings tab so the user can configure various aspects of the plugin
    this.addSettingTab(new IronVaultSettingTab(this.app, this));

    registerMoveBlock(this);
    registerOracleBlock(this, this.datastore);
    registerMechanicsBlock(this);
    registerTrackBlock(this);
    registerClockBlock(this);
    registerSidebarBlocks(this);
    registerCharacterBlock(this);
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
      new IronVaultPluginSettings(),
      await this.loadData(),
      // Remove unused old variables
      { moveBlockFormat: undefined },
    );
    this.settings = settings;
  }

  async onExternalSettingsChange() {
    Object.assign(this.settings, await this.loadData());
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  installIdLinkHandler(plugin: IronVaultPlugin) {
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
            [...plugin.datastore.moves.values()].find(
              (m) =>
                m._id === id || m.name.replace(/\s*/g, "").toLowerCase() === id,
            );
          const asset =
            !move &&
            [...plugin.datastore.assets.values()].find(
              (a) =>
                a._id === id || a.name.replace(/\s*/g, "").toLowerCase() === id,
            );
          if (oracle) {
            new OracleModal(plugin.app, plugin, oracle).open();
          } else if (move) {
            new MoveModal(plugin.app, plugin, move).open();
          } else if (asset) {
            new AssetModal(plugin.app, plugin, asset).open();
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
          const handler = (ev: MouseEvent) => {
            ev.stopPropagation();
            ev.preventDefault();
            const id = a.href
              .slice("id:".length)
              .replace(/\s*/g, "")
              .toLowerCase();
            const oracle = plugin.datastore.oracles.get(id);
            const move =
              !oracle &&
              [...plugin.datastore.moves.values()].find(
                (m) =>
                  m._id === id ||
                  m.name.replace(/\s*/g, "").toLowerCase() === id,
              );
            if (oracle) {
              new OracleModal(plugin.app, plugin, oracle).open();
            } else if (move) {
              new MoveModal(plugin.app, plugin, move).open();
            }
          };
          plugin.registerDomEvent(a, "click", handler);
        }
      });
    });
  }
}
