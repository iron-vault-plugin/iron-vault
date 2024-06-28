import { type Datasworn } from "@datasworn/core";
import { Rules } from "@datasworn/core/dist/Datasworn";
import dataswornSchema from "@datasworn/core/json/datasworn.schema.json" assert { type: "json" };
import ironswornRuleset from "@datasworn/ironsworn-classic/json/classic.json" assert { type: "json" };
import starforgedRuleset from "@datasworn/starforged/json/starforged.json" assert { type: "json" };
import Ajv from "ajv";
import { IDataContext } from "characters/action-context";
import {
  DataIndexer,
  SourceTag,
  StandardIndex,
  getHighestPriority,
  kindFiltered,
} from "datastore/data-indexer";
import {
  DataswornIndexer,
  DataswornTypes,
  createSource,
  walkDataswornRulesPackage,
} from "datastore/datasworn-indexer";
import Emittery from "emittery";
import IronVaultPlugin from "index";
import merge from "lodash.merge";
import { rootLogger } from "logger";
import { Oracle } from "model/oracle";
import { Component, Notice, TFile, TFolder, type App } from "obsidian";
import { OracleRoller } from "oracles/roller";
import { Ruleset } from "rules/ruleset";
import starforgedSupp from "../data/starforged.supplement.json" assert { type: "json" };
import { PLUGIN_DATASWORN_VERSION } from "./constants";

const logger = rootLogger.getLogger("datastore");

export class Datastore extends Component implements IDataContext {
  _ready: boolean;
  readonly indexer: DataswornIndexer = new DataIndexer();

  readonly waitForReady: Promise<void>;

  #readyNow!: () => void;

  emitter: Emittery;

  constructor(public readonly plugin: IronVaultPlugin) {
    super();
    this._ready = false;
    this.emitter = new Emittery();

    this.plugin.settings.on("change", ({ key }) => {
      if (
        key === "enableIronsworn" ||
        key === "enableStarforged" ||
        key === "useHomebrew" ||
        key === "homebrewPath"
      ) {
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

    if (this.plugin.settings.enableIronsworn) {
      this.indexBuiltInData(ironswornRuleset as Datasworn.Ruleset);
    }

    if (this.plugin.settings.enableStarforged) {
      // @ts-expect-error tsc seems to infer type of data in an incompatible way
      this.indexBuiltInData(starforgedRuleset as Datasworn.Ruleset);
      this.indexBuiltInData(starforgedSupp as Datasworn.Expansion, 5);
    }

    if (this.plugin.settings.useHomebrew) {
      if (this.plugin.settings.homebrewPath) {
        const homebrewFolder = this.plugin.app.vault.getFolderByPath(
          this.plugin.settings.homebrewPath,
        );
        if (homebrewFolder) {
          await this.indexDataswornFiles(homebrewFolder);
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
      this.oracles.size,
      this.moves.size,
      this.assets.size,
      this.truths.size,
    );
    this.emitter.emit("initialized");
    this.#readyNow();
  }

  indexBuiltInData(pkg: Datasworn.RulesPackage, priority: number = 0) {
    // TODO: properly support this.
    const mainPath = `@datasworn:${pkg._id}`;
    const source = createSource({
      path: mainPath,
      priority,
      sourceTags: { [SourceTag.RulesetId]: pkg._id },
    });
    this.indexer.index(
      source,
      walkDataswornRulesPackage(source, pkg, this.plugin),
    );

    this.app.metadataCache.trigger("iron-vault:index-changed");
  }

  removeBuiltInData(pkg: Datasworn.RulesPackage) {
    // TODO: properly support this.
    const mainPath = `@datasworn:${pkg._id}`;
    this.indexer.removeSource(mainPath);
    this.app.metadataCache.trigger("iron-vault:index-changed");
  }

  async indexDataswornFiles(folder: TFolder) {
    const ajv = new Ajv({ strict: false, validateFormats: false });
    const validate = ajv.compile(dataswornSchema);

    for (const file of folder.children) {
      if (file instanceof TFile && file.name.endsWith(".json")) {
        try {
          const data = JSON.parse(await this.app.vault.cachedRead(file));
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
            logger.error(msg, validate.errors);
            continue;
          }
          const dataswornPackage = data as Datasworn.RulesPackage;
          const rulesetId =
            dataswornPackage.type == "ruleset"
              ? dataswornPackage._id
              : dataswornPackage.ruleset;
          const source = createSource({
            path: file.path,
            priority: 10,
            sourceTags: { [SourceTag.RulesetId]: rulesetId },
          });
          this.indexer.index(
            source,
            walkDataswornRulesPackage(source, dataswornPackage, this.plugin),
          );
        } catch (e) {
          logger.error(e);
          continue;
        }
      }
    }
  }

  // async indexOraclesFolder(folder: TFolder): Promise<void> {
  //   logger.info("indexing folder %s", folder.path);
  //   const filesToIndex = new Map(
  //     breadthFirstTraversal<TFile, TAbstractFile>(
  //       folder,
  //       (node) => (node instanceof TFile ? node : undefined),
  //       (node) => (node instanceof TFolder ? node.children : []),
  //     ).map((p) => [p.path, p]),
  //   );

  //   const indexedPaths = new Set<string>();

  //   for (const fileToIndex of filesToIndex.values()) {
  //     if (await this.indexOracleFile(fileToIndex)) {
  //       indexedPaths.add(fileToIndex.path);
  //     }
  //   }

  //   const pathsToRemove = this.index.updateIndexGroup(
  //     folder.path,
  //     indexedPaths,
  //   );

  //   for (const pathToRemove of pathsToRemove) {
  //     logger.debug(
  //       "index: previously indexed data file %s (part of %s) no longer indexable, removing...",
  //       pathToRemove,
  //       folder.path,
  //     );
  //   }
  // }

  // async indexOracleFile(file: TFile): Promise<boolean> {
  //   logger.info("indexing %s", file.path);
  //   const cache = this.app.metadataCache.getFileCache(file);
  //   const parser = parserForFrontmatter(file, cache);
  //   if (parser == null) {
  //     return false;
  //   }

  //   const content = await this.app.vault.cachedRead(file);
  //   let result: ParserReturn;
  //   try {
  //     result = parser(content);
  //   } catch (error) {
  //     result = {
  //       success: false,
  //       error:
  //         error instanceof Error
  //           ? error
  //           : new Error("unexpected parsing error", { cause: error }),
  //     };
  //   }

  //   if (!result.success) {
  //     logger.error(`[file: ${file.path}] error parsing file`, result.error);
  //     return false;
  //   }

  //   try {
  //     // TODO: validation?
  //     indexDataForgedData(
  //       this.index,
  //       file.path,
  //       result.priority ?? 1,
  //       result.rules,
  //     );
  //     return true;
  //   } catch (e) {
  //     logger.error(`[file: ${file.path}] error indexing file`, e);
  //     return false;
  //   }
  // }

  get ready(): boolean {
    return this._ready;
  }

  get moves(): StandardIndex<DataswornTypes["move"]> {
    this.assertReady();
    return kindFiltered("move", this.indexer).projected(
      (value) => getHighestPriority(value)?.value,
    );
  }

  get moveCategories(): StandardIndex<DataswornTypes["move_category"]> {
    this.assertReady();
    return this.indexer.prioritized
      .ofKind("move_category")
      .projected((entry) => entry.value);
  }
  get oracles(): StandardIndex<Oracle> {
    this.assertReady();
    return this.indexer.prioritized
      .ofKind("oracle")
      .projected((entry) => entry.value);
  }

  get assets(): StandardIndex<Datasworn.Asset> {
    this.assertReady();
    return this.indexer.prioritized
      .ofKind("asset")
      .projected((entry) => entry.value);
  }

  get truths(): StandardIndex<Datasworn.Truth> {
    this.assertReady();
    return this.indexer.prioritized
      .ofKind("truth")
      .projected((entry) => entry.value);
  }

  get roller(): OracleRoller {
    return new OracleRoller(this.oracles);
  }

  get ruleset(): Ruleset {
    this.assertReady();

    const ids: string[] = [];
    const rules = [...this.indexer.prioritized.ofKind("rules_package").values()]
      .map((pkg) => {
        ids.push(pkg.id);
        return pkg.value.rules;
      })
      .reduce((acc, rules) => merge(acc, rules)) as Rules;

    return new Ruleset(ids, rules);
  }

  private assertReady(): void {
    if (!this._ready) {
      throw new Error("data not loaded yet");
    }
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
