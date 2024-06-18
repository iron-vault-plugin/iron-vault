import { ViewPlugin, ViewUpdate } from "@codemirror/view";
import registerCharacterBlock from "characters/character-block";
import registerClockBlock from "clocks/clock-block";
import { IndexManager } from "indexer/manager";
import installMoveLinkHandler from "moves/link-override";
import { MoveModal } from "moves/move-modal";
import { Plugin, addIcon } from "obsidian";
import installOracleLinkHandler from "oracles/link-override";
import { OracleModal } from "oracles/oracle-modal";
import { IronVaultPluginSettings } from "settings";
import registerSidebarBlocks from "sidebar/sidebar-block";
import { SidebarView, VIEW_TYPE } from "sidebar/sidebar-view";
import registerAssetBlock from "assets/asset-block";
import { AssetModal } from "assets/asset-modal";
import { ProgressIndex, ProgressIndexer } from "tracks/indexer";
import installAssetLinkHandler from "assets/link-override";
import registerTrackBlock from "tracks/track-block";
import { IronVaultAPI } from "./api";
import { CharacterIndexer, CharacterTracker } from "./character-tracker";
import { ClockIndex, ClockIndexer } from "./clocks/clock-file";
import { Datastore } from "./datastore";
import registerMechanicsBlock from "./mechanics/mechanics-blocks";
import { registerMoveBlock } from "./moves/block";
import { registerOracleBlock } from "./oracles/render";
import { IronVaultSettingTab } from "./settings/ui";
import { pluginAsset } from "./utils/obsidian";
import { IronVaultCommands } from "commands";
import registerTruthBlock from "truths/truth-block";
import { initLogger } from "logger";
import { IronVaultLinkView, LINK_VIEW } from "docs/docs-view";

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
  commands!: IronVaultCommands;

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
    initLogger();
    await this.loadSettings();
    addIcon(
      "iron-vault",
      `<g fill="currentColor" transform="matrix(6.6666667,0,0,6.2533639,-3.3333334,-0.02691142)"><path d="m 11.28,5.72 a 0.75,0.75 0 0 1 0,1.06 l -4,4 a 0.75,0.75 0 0 1 -1.06,0 l -2,-2 A 0.75,0.75 0 0 1 5.28,7.72 l 1.47,1.47 3.47,-3.47 a 0.75,0.75 0 0 1 1.06,0 z" id="path1" /><path fill-rule="evenodd" d="m 6.834,0.33 a 2.25,2.25 0 0 1 2.332,0 l 5.25,3.182 A 2.25,2.25 0 0 1 15.5,5.436 v 5.128 a 2.25,2.25 0 0 1 -1.084,1.924 l -5.25,3.182 a 2.25,2.25 0 0 1 -2.332,0 L 1.584,12.488 A 2.25,2.25 0 0 1 0.5,10.564 V 5.436 A 2.25,2.25 0 0 1 1.584,3.512 Z m 1.555,1.283 a 0.75,0.75 0 0 0 -0.778,0 L 2.361,4.794 A 0.75,0.75 0 0 0 2,5.436 v 5.128 a 0.75,0.75 0 0 0 0.361,0.642 l 5.25,3.181 a 0.75,0.75 0 0 0 0.778,0 l 5.25,-3.181 A 0.75,0.75 0 0 0 14,10.564 V 5.436 A 0.75,0.75 0 0 0 13.639,4.794 Z" clip-rule="evenodd" /></g>`,
    );
    this.datastore = this.addChild(new Datastore(this));
    this.initializeIndexManager();
    this.settings.on("change", ({ key }) => {
      if (key === "enableIronsworn" || key === "enableStarforged") {
        this.removeChild(this.indexManager);
        this.initializeIndexManager();
        this.indexManager.initialize();
      }
    });

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
    this.registerView(
      LINK_VIEW,
      (leaf) => new IronVaultLinkView(this.app.workspace, leaf),
    );
    // This adds a status bar item to the bottom of the app. Does not work on mobile apps.
    // const statusBarItemEl = this.addStatusBarItem();
    // statusBarItemEl.setText("Status Bar Text");

    this.commands = new IronVaultCommands(this);
    this.commands.addCommands();
    this.addRibbonIcon("iron-vault", "Show Iron Vault commands", () => {
      this.commands.showCommandPicker();
    });

    // This adds a settings tab so the user can configure various aspects of the plugin
    this.addSettingTab(new IronVaultSettingTab(this.app, this));
    this.registerBlocks();
  }

  initializeIndexManager() {
    this.indexManager = this.addChild(new IndexManager(this.app));
    this.indexManager.registerHandler(
      (this.characterIndexer = new CharacterIndexer(this.datastore)),
    );
    this.indexManager.registerHandler(
      (this.progressIndexer = new ProgressIndexer()),
    );
    this.indexManager.registerHandler((this.clockIndexer = new ClockIndexer()));
  }

  registerBlocks() {
    registerMoveBlock(this);
    registerOracleBlock(this);
    registerMechanicsBlock(this);
    registerTrackBlock(this);
    registerClockBlock(this);
    registerSidebarBlocks(this);
    registerCharacterBlock(this);
    registerAssetBlock(this);
    registerTruthBlock(this);
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
            const asset =
              !move &&
              [...plugin.datastore.assets.values()].find(
                (a) =>
                  a._id === id ||
                  a.name.replace(/\s*/g, "").toLowerCase() === id,
              );
            if (oracle) {
              new OracleModal(plugin.app, plugin, oracle).open();
            } else if (move) {
              new MoveModal(plugin.app, plugin, move).open();
            } else if (asset) {
              new AssetModal(plugin.app, plugin, asset).open();
            }
          };
          plugin.registerDomEvent(a, "click", handler);
        }
      });
    });
  }
}
