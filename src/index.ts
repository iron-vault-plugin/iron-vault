import registerAssetBlock from "assets/asset-block";
import registerCharacterBlock from "characters/character-block";
import registerClockBlock from "clocks/clock-block";
import { IronVaultCommands } from "commands";
import { IronVaultLinkView, LINK_VIEW } from "docs/docs-view";
import { IndexManager } from "indexer/manager";
import installLinkHandler from "link-handler";
import { initLogger } from "logger";
import { checkIfMigrationNeededCommand } from "migrate/command";
import { Plugin, addIcon } from "obsidian";
import { IronVaultPluginSettings } from "settings";
import registerSidebarBlocks from "sidebar/sidebar-block";
import { SidebarView, VIEW_TYPE } from "sidebar/sidebar-view";
import { ProgressIndex, ProgressIndexer } from "tracks/indexer";
import registerTrackBlock from "tracks/track-block";
import registerTruthBlock from "truths/truth-block";
import { DiceOverlay } from "utils/dice-overlay";
import { IronVaultAPI } from "./api";
import { CharacterIndexer, CharacterTracker } from "./character-tracker";
import { ClockIndex, ClockIndexer } from "./clocks/clock-file";
import { Datastore } from "./datastore";
import registerMechanicsBlock from "./mechanics/mechanics-blocks";
import { registerMoveBlock } from "./moves/block";
import { registerOracleBlock } from "./oracles/render";
import { IronVaultSettingTab } from "./settings/ui";
import { pluginAsset } from "./utils/obsidian";

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
  diceOverlay!: DiceOverlay;
  initialized: boolean = false;

  private async initialize(): Promise<void> {
    if (this.initialized) {
      throw new Error("Why did we initialize again");
    }
    this.initialized = true;

    await this.datastore.initialize();
    await this.initLeaf();

    // Don't await this-- we don't care when or how it finishes.
    checkIfMigrationNeededCommand(this, true);
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
    this.datastore.on("initialized", () => {
      // Because certain file schemas (characters mainly) are dependent on the loaded Datasworn
      // data (mainly Rules), we reindex tracked entities when the datastore is refreshed.
      this.indexManager.indexAll();
    });

    if (this.app.workspace.layoutReady) {
      await this.initialize();
    } else {
      this.app.workspace.onLayoutReady(() => this.initialize());
    }

    window.IronVaultAPI = this.api = new IronVaultAPI(this);
    this.register(() => delete window.IronVaultAPI);
    installLinkHandler(this);

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
    this.diceOverlay = await DiceOverlay.init(this, document.body);
    this.register(() => this.diceOverlay.removeDiceOverlay());
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
}
