import "es-iterator-helpers/auto";

import registerAssetBlock from "assets/asset-block";
import { CampaignIndex, CampaignIndexer } from "campaigns/indexer";
import { CampaignManager } from "campaigns/manager";
import {
  CAMPAIGN_EDIT_VIEW_TYPE,
  CampaignEditView,
} from "campaigns/ui/edit-view";
import {
  INVALID_CAMPAIGNS_VIEW_TYPE,
  InvalidCampaignsView,
} from "campaigns/ui/invalid-campaigns";
import registerCharacterBlock from "characters/character-block";
import registerClockBlock from "clocks/clock-block";
import { IronVaultCommands } from "commands";
import { CONTENT_VIEW_TYPE, ContentView } from "datastore/view/content-view";
import { IronVaultLinkView, LINK_VIEW } from "docs/docs-view";
import { AsEmitting } from "indexer/index-interface";
import { IndexManager } from "indexer/manager";
import installLinkHandler from "link-handler";
import { initLogger, rootLogger } from "logger";
import { showMigrationView } from "migrate/command";
import { MigrationManager } from "migrate/manager";
import {
  IronVaultMigrationView,
  MIGRATION_VIEW_TYPE,
} from "migrate/migration-view";
import { addIcon, Plugin, TFile } from "obsidian";
import {
  checkForOnboarding,
  ONBOARDING_VIEW_TYPE,
  OnboardingView,
} from "onboarding/view";
import { IronVaultPluginSettings } from "settings";
import { IronVaultPluginLocalSettings } from "settings/local";
import registerSidebarBlocks from "sidebar/sidebar-block";
import { SIDEBAR_VIEW_TYPE, SidebarView } from "sidebar/sidebar-view";
import { TrackedEntities } from "te/index-interface";
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
import { IronVaultSettingTab } from "./settings/ui";
import { pluginAsset } from "./utils/obsidian";

const logger = rootLogger.getLogger("iron-vault-plugin");

export default class IronVaultPlugin extends Plugin implements TrackedEntities {
  settings!: IronVaultPluginSettings;
  localSettings!: IronVaultPluginLocalSettings;
  datastore!: Datastore;
  characterIndexer!: CharacterIndexer;
  progressIndexer!: ProgressIndexer;
  clockIndexer!: ClockIndexer;
  campaignIndexer!: CampaignIndexer;
  campaignManager!: CampaignManager;
  indexManager!: IndexManager;
  api!: IronVaultAPI;
  commands!: IronVaultCommands;
  diceOverlay!: DiceOverlay;
  initialized: boolean = false;
  migrationManager: MigrationManager = new MigrationManager(this);

  /** Called once Obsidian signals layout ready (at which point all files in the vault should
   * be in the fileMap. */
  private async initialize(): Promise<void> {
    logger.debug("Layout ready. Performing post-load initialize...");

    if (this.initialized) {
      throw new Error(
        "Plugin re-initialized after initial load. This is likely a bug in Iron Vault.",
      );
    }
    this.initialized = true;

    // Load local settings first
    await this.localSettings.loadData(this);

    // Load the data store data
    await this.datastore.initialize();

    this.initMainSidebarView();
    this.initContentSidebarView();

    this.registerEvent(
      this.migrationManager.on("needs-migration", () =>
        showMigrationView(this.app),
      ),
    );
    // Don't await this-- we don't care when or how it finishes.
    this.migrationManager.scan();

    // Get dice overlay ready
    this.diceOverlay.init();
  }

  public assetFilePath(assetPath: string) {
    return pluginAsset(this, assetPath);
  }

  get characters(): AsEmitting<CharacterTracker> {
    return this.characterIndexer.index;
  }

  get clocks(): AsEmitting<ClockIndex> {
    return this.clockIndexer.index;
  }

  get progressTracks(): AsEmitting<ProgressIndex> {
    return this.progressIndexer.index;
  }

  get campaigns(): AsEmitting<CampaignIndex> {
    return this.campaignIndexer.index;
  }

  async onload(): Promise<void> {
    initLogger();
    await this.loadSettings();
    addIcon(
      "iron-vault",
      `<g fill="none" stroke="currentColor" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"><path d="M 79.632,55.687986 H 92.303999" /><path d="m 7.824,89.479986 h 8.448 a 4.224,4.224 0 0 0 4.224,-4.224 V 38.791987 a 29.568,29.568 0 0 1 59.136,0 v 46.463999 a 4.224,4.224 0 0 0 4.224,4.224 h 8.447999" /><path d="M 20.496,55.687986 H 7.824" /><path d="M 37.392,47.239986 50.064,34.567987 62.736,47.239986 v 16.896 l -12.672,12.672 -12.672,-12.672 z" /></g>`,
    );

    this.initializeDataSystems();
    this.register(
      this.datastore.on("initialized", () => {
        // Because certain file schemas (characters mainly) are dependent on the loaded Datasworn
        // data (mainly Rules), we reindex tracked entities when the datastore is refreshed.
        this.indexManager.indexAll();
      }),
    );

    this.registerEvent(
      this.indexManager.on("initialized", () => {
        checkForOnboarding(this);
        InvalidCampaignsView.showIfNeeded(this);
      }),
    );

    this.registerEvent(
      this.indexManager.on("initialized", () => {
        // Once content has been indexed, attempt to update the active campaign from the open
        // editor.
        this.campaignManager.resetActiveCampaign();
      }),
    );

    this.app.workspace.onLayoutReady(() => this.initialize());

    window.IronVaultAPI = this.api = new IronVaultAPI(this);
    this.register(() => delete window.IronVaultAPI);
    installLinkHandler(this);

    this.registerView(SIDEBAR_VIEW_TYPE, (leaf) => new SidebarView(leaf, this));
    this.registerView(
      CONTENT_VIEW_TYPE,
      (leaf) => new ContentView(leaf, this.datastore.dataManager),
    );
    this.registerView(LINK_VIEW, (leaf) => new IronVaultLinkView(leaf));
    this.registerView(
      MIGRATION_VIEW_TYPE,
      (leaf) => new IronVaultMigrationView(leaf, this),
    );
    this.registerView(
      ONBOARDING_VIEW_TYPE,
      (leaf) => new OnboardingView(leaf, this),
    );
    this.registerView(
      INVALID_CAMPAIGNS_VIEW_TYPE,
      (leaf) => new InvalidCampaignsView(leaf, this),
    );
    this.registerView(
      CAMPAIGN_EDIT_VIEW_TYPE,
      (leaf) => new CampaignEditView(leaf, this),
    );
    this.registerEvent(
      this.app.workspace.on("file-menu", (menu, file) => {
        if (file instanceof TFile && this.campaigns.has(file.path)) {
          menu.addItem((item) => {
            item
              .setTitle("Edit campaign")
              .setIcon("document")
              .onClick(async () =>
                CampaignEditView.openFile(this.app, file.path),
              );
          });
        }
      }),
    );

    this.commands = new IronVaultCommands(this);
    this.commands.addCommands();
    this.addRibbonIcon("iron-vault", "Show Iron Vault commands", () => {
      this.commands.showCommandPicker();
    });

    // This adds a settings tab so the user can configure various aspects of the plugin
    this.addSettingTab(new IronVaultSettingTab(this.app, this));
    this.registerBlocks();
    this.diceOverlay = this.addChild(new DiceOverlay(this, document.body));
  }

  initializeDataSystems() {
    this.datastore = this.addChild(new Datastore(this));
    this.indexManager = this.addChild(new IndexManager(this.app));

    // Initializes campaigns and the campaign manager first
    this.indexManager.registerHandler(
      (this.campaignIndexer = new CampaignIndexer()),
    );
    this.campaignManager = this.addChild(new CampaignManager(this));

    this.indexManager.registerHandler(
      (this.characterIndexer = new CharacterIndexer(this.campaignManager)),
    );
    this.indexManager.registerHandler(
      (this.progressIndexer = new ProgressIndexer()),
    );
    this.indexManager.registerHandler((this.clockIndexer = new ClockIndexer()));
  }

  registerBlocks() {
    registerMoveBlock(this);
    registerMechanicsBlock(this);
    registerTrackBlock(this);
    registerClockBlock(this);
    registerSidebarBlocks(this);
    registerCharacterBlock(this);
    registerAssetBlock(this);
    registerTruthBlock(this);
  }

  onUserEnable(): void {}

  onUserDisable(): void {
    // Detach the sidebar views when the plugin is disabled
    // this.app.workspace.detachLeavesOfType(SIDEBAR_VIEW_TYPE);
    // this.app.workspace.detachLeavesOfType(CONTENT_VIEW_TYPE);
  }

  async activateMainSidebarView() {
    const { workspace } = this.app;
    const leaf = await this.initMainSidebarView();
    if (leaf) workspace.revealLeaf(leaf);
  }

  async initMainSidebarView() {
    for (const leaf of this.app.workspace.getLeavesOfType(SIDEBAR_VIEW_TYPE)) {
      return leaf;
    }
    const leaf = this.app.workspace.getRightLeaf(false);
    await leaf?.setViewState({
      type: SIDEBAR_VIEW_TYPE,
    });
    return leaf;
  }

  async initContentSidebarView() {
    for (const leaf of this.app.workspace.getLeavesOfType(CONTENT_VIEW_TYPE)) {
      return leaf;
    }
    const leaf = this.app.workspace.getRightLeaf(false);
    await leaf?.setViewState({
      type: CONTENT_VIEW_TYPE,
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

    // We initialize local settings here (so things can watch it)-- but we don't load it
    // until after layout is ready (when fileMap is available)
    this.localSettings = new IronVaultPluginLocalSettings();
  }

  async onExternalSettingsChange() {
    Object.assign(this.settings, await this.loadData());
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
    await this.localSettings.saveData(this);
  }
}
