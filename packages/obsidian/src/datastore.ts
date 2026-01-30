import { type Datasworn } from "@datasworn/core";
import { classic as ironswornRuleset } from "@datasworn/ironsworn-classic";
import { delve as ironswornDelvePackage } from "@datasworn/ironsworn-classic-delve";
import { starforged as starforgedRuleset } from "@datasworn/starforged";
import { sundered_isles as sunderedIslesPackage } from "@datasworn/sundered-isles";
import { ancient_wonders as ancientWondersPackage } from "@datasworn-community-content/ancient-wonders";
import { fe_runners as feRunnersPackage } from "@datasworn-community-content/fe-runners";
import { ironsmith as ironsmithPackage } from "@datasworn-community-content/ironsmith";
import { starsmith as starsmithPackage } from "@datasworn-community-content/starsmith";
import Ajv from "ajv";
import { BaseDataContext } from "datastore/data-context";
import { DataIndexer } from "datastore/data-indexer";
import {
  createSource,
  DataswornIndexer,
  walkDataswornRulesPackage,
} from "datastore/datasworn-indexer";
import { DataManager } from "datastore/loader/manager";
import Emittery from "emittery";
import IronVaultPlugin from "index";
import { rootLogger } from "logger";
import { Component, debounce, type App } from "obsidian";
import starforgedSupp from "../data/starforged.supplement.json" assert { type: "json" };
import sunderedSupp from "../data/sundered-isles.supplement.json" assert { type: "json" };

const logger = rootLogger.getLogger("datastore");

const BUILTIN_SOURCES: [Datasworn.RulesPackage, number, boolean][] = [
  [ironswornRuleset, 0, false],
  [ironswornDelvePackage, 0, false],

  [starforgedRuleset, 0, false],
  [starforgedSupp as Datasworn.Expansion, 5, false],

  [sunderedIslesPackage, 0, false],
  [sunderedSupp as Datasworn.Expansion, 5, false],

  [ancientWondersPackage, 0, true],
  [feRunnersPackage, 0, true],
  [ironsmithPackage, 0, true],
  [starsmithPackage, 0, true],
];

export class Datastore extends Component {
  _ready: boolean;
  readonly indexer: DataswornIndexer = new DataIndexer();
  readonly dataContext: BaseDataContext = new BaseDataContext(
    this.indexer.dataMap,
  );

  readonly waitForReady: Promise<void>;

  #readyNow!: () => void;

  dataManager: DataManager;

  emitter: Emittery;

  ajv: Ajv = new Ajv({ strict: false, validateFormats: false });

  constructor(public readonly plugin: IronVaultPlugin) {
    super();
    this._ready = false;
    this.emitter = new Emittery();
    this.triggerIndexChanged = debounce(
      this.triggerIndexChanged.bind(this),
      100,
      true,
    );

    this.dataManager = this.addChild(new DataManager(this.plugin));

    this.waitForReady = new Promise((resolve) => {
      this.#readyNow = resolve;
    });
  }

  get app(): App {
    return this.plugin.app;
  }

  async initialize(reload: boolean = false): Promise<void> {
    this._ready = false;
    this.indexer.clear();

    for (const [pkg, priority, isCommunity] of BUILTIN_SOURCES) {
      this.indexBuiltInData(pkg, priority, isCommunity);
    }

    if (this.plugin.settings.useHomebrew) {
      if (this.plugin.settings.homebrewPath) {
        this.dataManager.setHomebrewRoot(
          this.plugin.settings.homebrewPath,
          true,
        );
      }
    }

    if (reload) {
      await this.dataManager.reindexAll();
    }
  }

  override onload(): void {
    logger.info("Datastore loading...");
    super.onload();
    // Monitor the vault for changes within the homebrew folder and reindex top level entities
    // as needed

    this.register(
      this.plugin.settings.on("change", ({ key }) => {
        if (key === "useHomebrew" || key === "homebrewPath") {
          this.dataManager.setHomebrewRoot(
            this.plugin.settings.useHomebrew
              ? this.plugin.settings.homebrewPath || null
              : null,
            true,
          );
        }
      }),
    );

    this.register(
      this.dataManager.on(
        "updated:package",
        ({ root, files, rulesPackage }) => {
          logger.debug(
            "Datastore updated package: %s %o",
            root,
            structuredClone(rulesPackage),
          );

          for (const [path, result] of files.entries()) {
            logger.debug(
              "Datastore updated file: %s, result: %o",
              path,
              result,
            );
          }

          if (rulesPackage) {
            const source = createSource({
              path: root,
              // Campaign content has highest priority
              // TODO: something smarter than just checking the package id...
              priority: root.startsWith("@")
                ? 0
                : rulesPackage._id === "campaign"
                  ? 20
                  : 10,
            });
            logger.debug("[datastore] Adding package to index: %s", root);
            this.indexer.index(source, walkDataswornRulesPackage(rulesPackage));
          } else {
            logger.debug("[datastore] Removing package from index: %s", root);
            this.indexer.removeSource(root);
          }
          this.triggerIndexChanged();
        },
      ),
    );
  }

  triggerIndexChanged() {
    if (!this._ready) {
      if (
        BUILTIN_SOURCES.every(
          ([pkg]) =>
            this.indexer.hasSource(`@datasworn/${pkg._id}.json`) ||
            this.indexer.hasSource(
              `@datasworn-community-content/${pkg._id}.json`,
            ),
        )
      ) {
        this._ready = true;
        console.info(
          "iron-vault: init complete. loaded: %d oracles, %d moves, %d assets, %d truths",
          this.dataContext.oracles.size,
          this.dataContext.moves.size,
          this.dataContext.assets.size,
          this.dataContext.truths.size,
        );
        this.emitter.emit("initialized");
        this.#readyNow();
      } else {
        logger.info(
          "iron-vault: still waiting for built-in data to be indexed...",
        );
      }
    }
    this.app.metadataCache.trigger("iron-vault:index-changed");
  }

  /** Registers a monitored campaign content path. */
  registerCampaignContentPath(path: string) {
    logger.debug("Registering campaign content path %s", path);
    this.dataManager.addCampaignContentRoot(path);
  }

  /** Unregisters a monitored campaign content path. */
  unregisterCampaignContentPathByRoot(campaignRoot: string) {
    this.dataManager.removeCampaignContentRoot(campaignRoot);
    // TODO: need to deal with removing from index
    // for (const monitoredPath of this.#monitoredCampaignContentPaths) {
    //   if (childOfPath(campaignRoot, monitoredPath)) {
    //     logger.debug("Unregistering campaign content path %s", monitoredPath);
    //     this.#monitoredCampaignContentPaths.delete(monitoredPath);
    //     this.indexer.removeSource(monitoredPath);
    //     this.triggerIndexChanged();
    //     // TODO: is there a race condition here where a folder could be in the midst
    //     // of being indexed when we remove it?
    //   }
    // }
  }

  indexBuiltInData(
    pkg: Datasworn.RulesPackage,
    _priority: number = 0,
    isCommunity = false,
  ) {
    // if (isDebugEnabled()) {
    //   logger.debug("Validating datasworn package %s", pkg._id);
    //   const validate = this.ajv.compile(dataswornSchema);
    //   const result = validate(pkg);
    //   if (!result) {
    //     logger.error(
    //       "Invalid datasworn package: %s",
    //       (pkg as Datasworn.RulesPackage)._id,
    //       validate.errors,
    //     );
    //     return;
    //   }
    // }

    const path = `@datasworn${isCommunity ? "-community-content" : ""}/${pkg._id}.json`;
    this.dataManager.addCampaignContentRoot(path);
    this.dataManager.indexDirect({
      path,
      mtime: Date.now(),
      content: JSON.stringify(pkg),
      frontmatter: undefined,
    });
    // const source = createSource({
    //   path: mainPath,
    //   priority,
    // });
    // this.indexer.index(source, walkDataswornRulesPackage(pkg));
  }

  get ready(): boolean {
    return this._ready;
  }

  on<K extends keyof EVENT_TYPES>(
    event: K,
    listener: (params: EVENT_TYPES[K]) => void,
  ) {
    return this.emitter.on(event, listener);
  }

  once<K extends keyof EVENT_TYPES>(event: K) {
    return this.emitter.once(event);
  }

  off<K extends keyof EVENT_TYPES>(
    event: K,
    listener: (params: EVENT_TYPES[K]) => void,
  ) {
    return this.emitter.off(event, listener);
  }

  events<K extends keyof EVENT_TYPES>(event: K) {
    return this.emitter.events(event);
  }
}

export type EVENT_TYPES = {
  initialized: void;
};
