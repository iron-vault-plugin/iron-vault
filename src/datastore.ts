import { type Datasworn } from "@datasworn/core";
import dataswornSchema from "@datasworn/core/json/datasworn.schema.json" assert { type: "json" };
import ironswornDelvePackage from "@datasworn/ironsworn-classic-delve/json/delve.json" assert { type: "json" };
import ironswornRuleset from "@datasworn/ironsworn-classic/json/classic.json" assert { type: "json" };
import starforgedRuleset from "@datasworn/starforged/json/starforged.json" assert { type: "json" };
import sunderedIslesPackage from "@datasworn/sundered-isles/json/sundered_isles.json" assert { type: "json" };
import Ajv, { ValidateFunction } from "ajv";
import { BaseDataContext } from "datastore/data-context";
import { DataIndexer } from "datastore/data-indexer";
import {
  createSource,
  DataswornIndexer,
  walkDataswornRulesPackage,
} from "datastore/datasworn-indexer";
import { indexCollectionRoot } from "datastore/parsers/collection";
import Emittery from "emittery";
import IronVaultPlugin from "index";
import { isDebugEnabled, rootLogger } from "logger";
import {
  Component,
  debounce,
  Notice,
  parseYaml,
  TAbstractFile,
  TFile,
  TFolder,
  type App,
} from "obsidian";
import {
  WILDCARD_TARGET_RULESET,
  WILDCARD_TARGET_RULESET_PLACEHOLDER,
} from "rules/ruleset";
import { findTopLevelParentFolder } from "utils/obsidian";
import { childOfPath, findTopLevelParent } from "utils/paths";
import starforgedSupp from "../data/starforged.supplement.json" assert { type: "json" };
import sunderedSupp from "../data/sundered-isles.supplement.json" assert { type: "json" };
import { PLUGIN_DATASWORN_VERSION } from "./constants";

const logger = rootLogger.getLogger("datastore");

export class Datastore extends Component {
  _ready: boolean;
  readonly indexer: DataswornIndexer = new DataIndexer();
  readonly dataContext: BaseDataContext = new BaseDataContext(
    this.indexer.dataMap,
  );

  readonly waitForReady: Promise<void>;

  #readyNow!: () => void;

  #homebrewFolder: TFolder | null = null;
  #monitoredCampaignContentPaths: Set<string> = new Set();
  #reindexTimers = new Map<TAbstractFile, NodeJS.Timeout>();

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
    this.#monitoredCampaignContentPaths.clear();

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
        this.#homebrewFolder = this.plugin.app.vault.getFolderByPath(
          this.plugin.settings.homebrewPath,
        );
        if (this.#homebrewFolder) {
          await this.indexHomebrewTopLevels(this.#homebrewFolder.children);
        } else {
          new Notice(
            `Homebrew enabled, but path '${this.plugin.settings.homebrewPath}' is missing.`,
          );
          logger.warn(
            `Homebrew enabled, but path '${this.plugin.settings.homebrewPath}' is missing.`,
          );
        }
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
    // Monitor the vault for changes within the homebrew folder and reindex top level entities
    // as needed
    this.registerEvent(
      this.app.vault.on("modify", async (file) => {
        if (!this._ready) return;

        const topLevel =
          this.#homebrewFolder &&
          findTopLevelParentFolder(this.#homebrewFolder, file);
        if (topLevel) {
          logger.debug(
            "file modified: %s -> rebuild top level: %s",
            file.path,
            topLevel.path,
          );
          this.#queueReindex(topLevel);
        } else {
          // Check if the file is in a monitored campaign content path
          for (const monitoredPath of this.#monitoredCampaignContentPaths) {
            if (childOfPath(monitoredPath, file.path)) {
              logger.debug(
                "file modified: %s -> reindex campaign content: %s",
                file.path,
                monitoredPath,
              );
              this.#queueCampaignContentReindex(monitoredPath);
              break;
            }
          }
        }
      }),
    );
    this.registerEvent(
      this.app.vault.on("delete", async (file) => {
        if (!this._ready) return;

        // Since deleted files are not actually in the hierarchy, we won't be
        // able to find the parent if it was a top-level file.
        const topLevel =
          this.#homebrewFolder &&
          findTopLevelParent(this.#homebrewFolder.path, file.path);

        if (topLevel) {
          logger.debug(
            "file deleted: %s from top level: %s",
            file.path,
            topLevel,
          );
          const topLevelPath = this.#homebrewFolder!.path + "/" + topLevel;
          if (file.path === topLevelPath) {
            logger.debug("homebrew top level deleted: %s", topLevel);

            this.#reindexTimers.delete(file);
            this.indexer.removeSource(topLevelPath);
            this.triggerIndexChanged();
          } else {
            logger.debug("homebrew child deleted. reindexing top level");
            this.#queueReindex(
              this.#homebrewFolder!.children.find(
                (child) => child.name === topLevel,
              )!,
            );
          }
        } else {
          // Check if the file is in a monitored campaign content path
          for (const monitoredPath of this.#monitoredCampaignContentPaths) {
            if (
              monitoredPath === file.path ||
              childOfPath(monitoredPath, file.path)
            ) {
              logger.debug(
                "file deleted: %s -> reindex campaign content: %s",
                file.path,
                monitoredPath,
              );
              this.#queueCampaignContentReindex(monitoredPath);
              break;
            }
          }
        }
      }),
    );
    this.registerEvent(
      this.app.vault.on("rename", async (file, oldPath) => {
        if (!this._ready) return;

        const topLevel =
          this.#homebrewFolder &&
          findTopLevelParentFolder(this.#homebrewFolder, file);
        if (topLevel) {
          // Old path might be a top-level file, so let's just delete it to be sure.
          this.indexer.removeSource(oldPath);

          logger.debug(
            "file renamed: %s -> rebuild top level: %s",
            oldPath,
            topLevel.path,
          );
          this.#queueReindex(topLevel);
        } else {
          // First, let's see if the old path is in a monitored campaign content path
          for (const monitoredPath of this.#monitoredCampaignContentPaths) {
            if (
              monitoredPath === oldPath ||
              childOfPath(monitoredPath, oldPath)
            ) {
              logger.debug(
                "file renamed: %s to %s -> reindex content: monitoredPath",
                oldPath,
                file.path,
                monitoredPath,
              );
              this.#queueCampaignContentReindex(monitoredPath);
              break;
            }
          }

          // Now, let's check if the new path is in a monitored campaign content path
          // Note that the debounce on the reindexing will prevent duplication if the
          // old path and new path are in the same monitored path.
          for (const monitoredPath of this.#monitoredCampaignContentPaths) {
            if (
              monitoredPath === file.path ||
              childOfPath(monitoredPath, file.path)
            ) {
              logger.debug(
                "file renamed: %s to %s -> reindex campaign content: %s",
                oldPath,
                file.path,
                monitoredPath,
              );
              this.#queueCampaignContentReindex(monitoredPath);
              break;
            }
          }
        }
      }),
    );
  }

  triggerIndexChanged() {
    this.app.metadataCache.trigger("iron-vault:index-changed");
  }

  /** Registers a monitored campaign content path. */
  registerCampaignContentPath(path: string) {
    logger.debug("Registering campaign content path %s", path);
    this.#monitoredCampaignContentPaths.add(path);
    this.#queueCampaignContentReindex(path);
  }

  /** Unregisters a monitored campaign content path. */
  unregisterCampaignContentPathByRoot(campaignRoot: string) {
    for (const monitoredPath of this.#monitoredCampaignContentPaths) {
      if (childOfPath(campaignRoot, monitoredPath)) {
        logger.debug("Unregistering campaign content path %s", monitoredPath);
        this.#monitoredCampaignContentPaths.delete(monitoredPath);
        this.indexer.removeSource(monitoredPath);
        this.triggerIndexChanged();
        // TODO: is there a race condition here where a folder could be in the midst
        // of being indexed when we remove it?
      }
    }
  }

  #queueReindex(file: TAbstractFile) {
    if (this.#reindexTimers.has(file)) {
      clearTimeout(this.#reindexTimers.get(file)!);
    }
    this.#reindexTimers.set(
      file,
      setTimeout(
        () => !file.deleted && this.indexHomebrewTopLevels([file]),
        2000,
      ),
    );
  }

  #queueCampaignContentReindex(contentFolderPath: string) {
    const folder = this.app.vault.getAbstractFileByPath(contentFolderPath);
    if (folder == null || !(folder instanceof TFolder)) {
      if (this.indexer.hasSource(contentFolderPath)) {
        logger.debug(
          "Removing stale campaign content folder %s from index",
          contentFolderPath,
        );
        this.indexer.removeSource(contentFolderPath);
        this.triggerIndexChanged();
      }
      return;
    }

    if (this.#reindexTimers.has(folder)) {
      clearTimeout(this.#reindexTimers.get(folder)!);
    }
    this.#reindexTimers.set(
      folder,
      setTimeout(async () => {
        if (
          folder.deleted ||
          !this.#monitoredCampaignContentPaths.has(folder.path)
        ) {
          logger.debug(
            "Removing stale campaign content folder %s from index",
            folder.path,
          );
          this.indexer.removeSource(folder.path);
          this.triggerIndexChanged();
        } else {
          logger.debug("Reindexing campaign content folder %s", folder.path);
          await this.indexHomebrewFolder(folder, true);
        }
      }, 2000),
    );
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

  async indexHomebrewDataswornFile(
    validate: ValidateFunction<Datasworn.RulesPackage>,
    file: TFile,
  ) {
    try {
      let data;
      const priority = 10;
      if (file.extension == "json") {
        data = JSON.parse(await this.app.vault.cachedRead(file));
      } else if (file.extension == "yaml" || file.extension == "yml") {
        data = parseYaml(await this.app.vault.cachedRead(file));
      } else {
        logger.warn("Unsupported %s file: %s", file.extension, file.path);
      }

      if (!data) return;

      if (
        typeof data == "object" &&
        data?.ruleset === WILDCARD_TARGET_RULESET
      ) {
        data.ruleset = WILDCARD_TARGET_RULESET_PLACEHOLDER;
      }

      const result = validate(data);
      if (!result) {
        let msg: string;
        if (
          validate.errors?.find(
            (err) =>
              err.instancePath == "/datasworn_version" &&
              err.keyword == "const",
          )
        ) {
          msg = `Datasworn homebrew content file '${file.path}' uses Datasworn ${data["datasworn_version"]}, but Iron Vault expects Datasworn ${PLUGIN_DATASWORN_VERSION}.`;
        } else {
          msg = `Datasworn homebrew content file '${file.path}' is not a valid Datasworn ${PLUGIN_DATASWORN_VERSION}. Check the error message in the Developer tools console for more details.`;
        }

        new Notice(msg, 0);
        logger.error(msg, validate.errors, data);
        return;
      }
      if (data?.ruleset === WILDCARD_TARGET_RULESET_PLACEHOLDER) {
        data.ruleset = WILDCARD_TARGET_RULESET;
      }

      const dataswornPackage = data as Datasworn.RulesPackage;
      const source = createSource({
        path: file.path,
        priority,
      });
      this.indexer.index(source, walkDataswornRulesPackage(dataswornPackage));
      this.triggerIndexChanged();
    } catch (e) {
      new Notice(
        `Unable to import homebrew file: ${file.basename}\nReason: ${e}`,
        0,
      );
      logger.error(e);
    }
  }

  /**
   * Index the listed files as top-level homebrew content (either a single compiled Datasworn
   * package, or a folder containing source files)
   */
  async indexHomebrewTopLevels(filesOrFolders: TAbstractFile[]): Promise<void> {
    const validate = this.ajv.compile<Datasworn.RulesPackage>(dataswornSchema);

    for (const file of filesOrFolders) {
      if (file instanceof TFile) {
        if (
          file.extension == "json" ||
          file.extension == "yaml" ||
          file.extension == "yml"
        ) {
          await this.indexHomebrewDataswornFile(validate, file);
        } else if (file.extension == "md") {
          logger.info(
            "[datastore] Ignoring markdown file outside of Homebrew collection %s",
            file.path,
          );
          new Notice(
            `Homebrew Markdown file '${file.path}' must be part of a Homebrew collection folder.`,
            0,
          );
        }
      } else if (file instanceof TFolder) {
        await this.indexHomebrewFolder(file, false);
      }
    }
  }

  async indexHomebrewFolder(
    folder: TFolder,
    isCampaignContent: boolean,
  ): Promise<void> {
    try {
      const dataswornPackage = await indexCollectionRoot(
        this.app,
        folder,
        isCampaignContent ? "campaign" : undefined,
      );
      const source = createSource({
        path: folder.path,
        // Campaign content has highest priority
        priority: isCampaignContent ? 20 : 10,
      });
      this.indexer.index(source, walkDataswornRulesPackage(dataswornPackage));
      this.triggerIndexChanged();
    } catch (e) {
      logger.error("Error loading homebrew", e);
      new Notice(
        `Unable to import homebrew collection: ${folder.path}\nReason: ${e}`,
        0,
      );
    }
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
