import { type Datasworn } from "@datasworn/core";
import starforgedRuleset from "@datasworn/starforged/json/starforged.json" assert { type: "json" };
import { IDataContext } from "characters/action-context";
import {
  DataIndexer,
  SourceTag,
  StandardIndex,
  getHighestPriority,
  getHighestPriorityChecked,
  isOfKind,
} from "datastore/data-indexer";
import {
  DataswornIndexer,
  DataswornTypes,
  createSource,
  walkDataswornRulesPackage,
} from "datastore/datasworn-indexer";
import IronVaultPlugin from "index";
import { Oracle } from "model/oracle";
import { Component, type App } from "obsidian";
import { OracleRoller } from "oracles/roller";
import { Ruleset } from "rules/ruleset";

export class Datastore extends Component implements IDataContext {
  _ready: boolean;
  readonly indexer: DataswornIndexer = new DataIndexer();

  readonly waitForReady: Promise<void>;

  #readyNow!: () => void;

  // TODO: wtf
  activeRuleset: string = "starforged";

  constructor(public readonly plugin: IronVaultPlugin) {
    super();
    this._ready = false;

    this.waitForReady = new Promise((resolve) => {
      this.#readyNow = resolve;
    });
  }

  get app(): App {
    return this.plugin.app;
  }

  async initialize(): Promise<void> {
    this.indexBuiltInData(starforgedRuleset as Datasworn.Ruleset);

    // TODO: also handle folders
    // const dataFiles = await this.app.vault.adapter.list(
    //   this.plugin.assetFilePath("data"),
    // );
    // for (const dataFilePath of dataFiles.files) {
    //   let extension = dataFilePath.split(".").pop();
    //   if (extension === "yml") {
    //     extension = "yaml";
    //   }
    //   if (extension === "yml" || extension === "yaml" || extension === "json") {
    //     await this.indexPluginFile(dataFilePath, 0, extension);
    //   }
    // }

    // if (this.plugin.settings.oraclesFolder != "") {
    //   const oraclesFolderFile = this.app.vault.getAbstractFileByPath(
    //     this.plugin.settings.oraclesFolder,
    //   );
    //   if (
    //     oraclesFolderFile == null ||
    //     !(oraclesFolderFile instanceof TFolder)
    //   ) {
    //     logger.error(
    //       "oracle folders: expected '%s' to be folder",
    //       oraclesFolderFile,
    //     );
    //   } else {
    //     this.indexOraclesFolder(oraclesFolderFile);
    //   }
    // }

    this._ready = true;
    console.info(
      "iron-vault: init complete. loaded: %d oracles, %d moves, %d assets, %d truths",
      this.oracles.size,
      this.moves.size,
      this.assets.size,
      this.truths.size,
    );
    this.#readyNow();
  }

  indexBuiltInData(pkg: Datasworn.RulesPackage) {
    // TODO: properly support this.
    const mainPath = `@datasworn:${pkg._id}`;
    const source = createSource({
      path: mainPath,
      priority: 0,
      sourceTags: { [SourceTag.RulesetId]: pkg._id },
    });
    this.indexer.index(source, walkDataswornRulesPackage(source, pkg));

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

    const packages = this.indexer.get(this.activeRuleset);
    if (
      !packages ||
      !isOfKind<DataswornTypes, "rules_package">(packages, "rules_package")
    ) {
      throw new Error(`missing ruleset ${this.activeRuleset}`);
    }

    const pkg = getHighestPriorityChecked(packages);

    // TODO: figure out expansions and what not. kinda think I want to filter down to all available
    // rulesets and merge them?

    if (pkg.value.type != "ruleset")
      throw new Error(`expected 'ruleset', but ${pkg.id} is ${pkg.value.type}`);

    return new Ruleset(pkg?.id, pkg.value.rules);
  }

  private assertReady(): void {
    if (!this._ready) {
      throw new Error("data not loaded yet");
    }
  }
}
