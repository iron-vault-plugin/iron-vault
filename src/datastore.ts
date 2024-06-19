import { type Datasworn } from "@datasworn/core";
import { Rules, RulesPackage } from "@datasworn/core/dist/Datasworn";
import ironswornRuleset from "@datasworn/ironsworn-classic/json/classic.json" assert { type: "json" };
import starforgedRuleset from "@datasworn/starforged/json/starforged.json" assert { type: "json" };
import { IDataContext } from "characters/action-context";
import {
  DataIndexer,
  SourceTag,
  Sourced,
  StandardIndex,
  getHighestPriority,
  isOfKind,
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
import { Oracle } from "model/oracle";
import { Component, type App } from "obsidian";
import { OracleRoller } from "oracles/roller";
import { Ruleset } from "rules/ruleset";
import starforgedSupp from "../data/starforged.supplement.json" assert { type: "json" };

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
      if (key === "enableIronsworn" || key === "enableStarforged") {
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
    if (this.plugin.settings.enableIronsworn) {
      this.indexBuiltInData(ironswornRuleset as Datasworn.Ruleset);
    } else {
      this.removeBuiltInData(ironswornRuleset as Datasworn.Ruleset);
    }
    if (this.plugin.settings.enableStarforged) {
      this.indexBuiltInData(starforgedRuleset as Datasworn.Ruleset);
      this.indexBuiltInData(starforgedSupp as Datasworn.Expansion, 5);
    } else {
      this.removeBuiltInData(starforgedSupp as Datasworn.Expansion);
      this.removeBuiltInData(starforgedRuleset as Datasworn.Ruleset);
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

  // async indexPluginFile(
  //   normalizedPath: string,
  //   priority: number,
  //   format: string = "json",
  // ): Promise<void> {
  //   logger.info(
  //     "iron-vault: datastore: indexing plugin file %s (format: %s priority: %d)",
  //     normalizedPath,
  //     format,
  //     priority,
  //   );
  //   const content = await this.app.vault.adapter.read(normalizedPath);
  //   // TODO: validate
  //   let data: Datasworn.RulesPackage;
  //   if (format === "json") {
  //     data = JSON.parse(content) as Datasworn.RulesPackage;
  //   } else if (format === "yaml") {
  //     data = parseYaml(content) as Datasworn.RulesPackage;
  //   } else {
  //     throw new Error(`unknown file type ${format}`);
  //   }
  //   indexDataForgedData(this.index, normalizedPath, priority, data);
  //   this.index.updateIndexGroup(normalizedPath, new Set([normalizedPath]));

  //   this.app.metadataCache.trigger("iron-vault:index-changed");
  // }

  get ready(): boolean {
    return this._ready;
  }

  // get data(): Starforged | undefined {
  //   return this._data;
  // }

  get moves(): StandardIndex<DataswornTypes["move"]> {
    this.assertReady();
    return this.indexer.projected((value) =>
      isOfKind<DataswornTypes, "move">(value, "move")
        ? getHighestPriority(value)?.value
        : undefined,
    );
  }

  get moveCategories(): StandardIndex<DataswornTypes["move_category"]> {
    this.assertReady();
    return this.indexer.projected((value) =>
      isOfKind<DataswornTypes, "move_category">(value, "move_category")
        ? getHighestPriority(value)?.value
        : undefined,
    );
  }
  get oracles(): StandardIndex<Oracle> {
    this.assertReady();
    return this.indexer.projected((value) =>
      isOfKind<DataswornTypes, "oracle">(value, "oracle")
        ? getHighestPriority(value)?.value
        : undefined,
    );
  }

  get assets(): StandardIndex<Datasworn.Asset> {
    this.assertReady();
    return this.indexer.projected((value) =>
      isOfKind<DataswornTypes, "asset">(value, "asset")
        ? getHighestPriority(value)?.value
        : undefined,
    );
  }

  get truths(): StandardIndex<Datasworn.Truth> {
    this.assertReady();
    return this.indexer.projected((value) =>
      isOfKind<DataswornTypes, "truth">(value, "truth")
        ? getHighestPriority(value)?.value
        : undefined,
    );
  }

  get roller(): OracleRoller {
    return new OracleRoller(this.oracles);
  }

  get ruleset(): Ruleset {
    this.assertReady();

    const rules = [...this.indexer.values()]
      .filter((v) =>
        isOfKind<DataswornTypes, "rules_package">(v, "rules_package"),
      )
      .flat()
      .map((v) => (v as Sourced<"rules_package", RulesPackage>).value.rules)
      .reduce((acc, rules) => merge(acc, rules)) as Rules;

    return new Ruleset("iron-vault-active-ruleset", rules);
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
