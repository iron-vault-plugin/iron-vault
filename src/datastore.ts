import { type Datasworn } from "@datasworn/core";
import dataswornSchema from "@datasworn/core/json/datasworn.schema.json" assert { type: "json" };
import ironswornDelvePackage from "@datasworn/ironsworn-classic-delve/json/delve.json" assert { type: "json" };
import ironswornRuleset from "@datasworn/ironsworn-classic/json/classic.json" assert { type: "json" };
import starforgedRuleset from "@datasworn/starforged/json/starforged.json" assert { type: "json" };
import sunderedIslesPackage from "@datasworn/sundered-isles/json/sundered_isles.json" assert { type: "json" };
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
import { isDebugEnabled, rootLogger } from "logger";
import { Component, debounce, Notice, type App } from "obsidian";
import starforgedSupp from "../data/starforged.supplement.json" assert { type: "json" };
import sunderedSupp from "../data/sundered-isles.supplement.json" assert { type: "json" };

const logger = rootLogger.getLogger("datastore");

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

    this.plugin.settings.on("change", ({ key }) => {
      if (key === "useHomebrew" || key === "homebrewPath") {
        this.initialize();
      }
    });

    this.waitForReady = new Promise((resolve) => {
      this.#readyNow = resolve;
    });
  }

  get app(): App {
    return this.plugin.app;
  }

  async initialize(): Promise<void> {
    this._ready = false;
    this.indexer.clear();
    // TODO: clear the roots in the data manager

    this.indexBuiltInData(ironswornRuleset as Datasworn.Ruleset);

    // @ts-expect-error tsc seems to infer type of data in an incompatible way
    this.indexBuiltInData(ironswornDelvePackage as Datasworn.Expansion);

    // @ts-expect-error tsc seems to infer type of data in an incompatible way
    this.indexBuiltInData(starforgedRuleset as Datasworn.Ruleset);
    this.indexBuiltInData(starforgedSupp as Datasworn.Expansion, 5);

    this.indexBuiltInData(sunderedIslesPackage as Datasworn.Expansion);
    this.indexBuiltInData(sunderedSupp as Datasworn.Expansion, 5);

    if (this.plugin.settings.useHomebrew) {
      if (this.plugin.settings.homebrewPath) {
        this.dataManager.setHomebrewRoot(
          this.plugin.settings.homebrewPath,
          true,
        );
      } else {
        new Notice("Homebrew enabled, but path is empty.");
      }
    }

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
  }

  onload(): void {
    logger.info("Datastore loading...");
    super.onload();
    // Monitor the vault for changes within the homebrew folder and reindex top level entities
    // as needed
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
              priority: rulesPackage._id === "campaign" ? 20 : 10,
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

  indexBuiltInData(pkg: Datasworn.RulesPackage, priority: number = 0) {
    if (isDebugEnabled()) {
      logger.debug("Validating datasworn package %s", pkg._id);
      const validate = this.ajv.compile(dataswornSchema);
      const result = validate(pkg);
      if (!result) {
        logger.error(
          "Invalid datasworn package: %s",
          (pkg as Datasworn.RulesPackage)._id,
          validate.errors,
        );
        return;
      }
    }

    const mainPath = `@datasworn:${pkg._id}`;
    const source = createSource({
      path: mainPath,
      priority,
    });
    this.indexer.index(source, walkDataswornRulesPackage(pkg));

    this.triggerIndexChanged();
  }

  removeBuiltInData(pkg: Datasworn.RulesPackage) {
    const mainPath = `@datasworn:${pkg._id}`;
    this.indexer.removeSource(mainPath);
    this.app.metadataCache.trigger("iron-vault:index-changed");
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
