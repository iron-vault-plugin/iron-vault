import { Asset, Move, RulesPackage } from "@datasworn/core";
import { DataIndex } from "datastore/data-index";
import { indexDataForgedData } from "datastore/parsers/dataforged";
import { ParserReturn, parserForFrontmatter } from "datastore/parsers/markdown";
import { StandardIndex } from "datastore/priority-index";
import ForgedPlugin from "index";
import { Oracle } from "model/oracle";
import {
  Component,
  TAbstractFile,
  TFile,
  TFolder,
  parseYaml,
  type App,
} from "obsidian";
import { OracleRoller } from "oracles/roller";
import { Ruleset } from "rules/ruleset";
import { breadthFirstTraversal } from "utils/traversal";

export class Datastore extends Component {
  _ready: boolean;
  readonly index: DataIndex;

  readonly waitForReady: Promise<void>;

  #readyNow!: () => void;

  // TODO: wtf
  activeRuleset: string = "starforged";

  constructor(public readonly plugin: ForgedPlugin) {
    super();
    this._ready = false;

    this.index = new DataIndex();
    this.waitForReady = new Promise((resolve) => {
      this.#readyNow = resolve;
    });
  }

  get app(): App {
    return this.plugin.app;
  }

  async initialize(): Promise<void> {
    // todo: also handle folders
    const dataFiles = await this.app.vault.adapter.list(
      this.plugin.assetFilePath("data"),
    );
    for (const dataFilePath of dataFiles.files) {
      let extension = dataFilePath.split(".").pop();
      if (extension === "yml") {
        extension = "yaml";
      }
      if (extension === "yml" || extension === "yaml" || extension === "json") {
        await this.indexPluginFile(dataFilePath, 0, extension);
      }
    }

    if (this.plugin.settings.oraclesFolder != "") {
      const oraclesFolderFile = this.app.vault.getAbstractFileByPath(
        this.plugin.settings.oraclesFolder,
      );
      if (
        oraclesFolderFile == null ||
        !(oraclesFolderFile instanceof TFolder)
      ) {
        console.error(
          "oracle folders: expected '%s' to be folder",
          oraclesFolderFile,
        );
      } else {
        this.indexOraclesFolder(oraclesFolderFile);
      }
    }
    console.log(
      "forged: init complete. loaded: %d oracles, %d moves, %d assets",
      this.index._oracleIndex.size,
      this.index._moveIndex.size,
      this.index._assetIndex.size,
    );
    this._ready = true;
    this.#readyNow();
  }

  async indexOraclesFolder(folder: TFolder): Promise<void> {
    console.log("indexing folder %s", folder.path);
    const filesToIndex = new Map(
      breadthFirstTraversal<TFile, TAbstractFile>(
        folder,
        (node) => (node instanceof TFile ? node : undefined),
        (node) => (node instanceof TFolder ? node.children : []),
      ).map((p) => [p.path, p]),
    );

    const indexedPaths = new Set<string>();

    for (const fileToIndex of filesToIndex.values()) {
      if (await this.indexOracleFile(fileToIndex)) {
        indexedPaths.add(fileToIndex.path);
      }
    }

    const pathsToRemove = this.index.updateIndexGroup(
      folder.path,
      indexedPaths,
    );

    for (const pathToRemove of pathsToRemove) {
      console.log(
        "index: previously indexed data file %s (part of %s) no longer indexable, removing...",
        pathToRemove,
        folder.path,
      );
    }
  }

  async indexOracleFile(file: TFile): Promise<boolean> {
    console.log("indexing %s", file.path);
    const cache = this.app.metadataCache.getFileCache(file);
    const parser = parserForFrontmatter(file, cache);
    if (parser == null) {
      return false;
    }

    const content = await this.app.vault.cachedRead(file);
    let result: ParserReturn;
    try {
      result = parser(content);
    } catch (error) {
      result = {
        success: false,
        error:
          error instanceof Error
            ? error
            : new Error("unexpected parsing error", { cause: error }),
      };
    }

    if (!result.success) {
      console.error(`[file: ${file.path}] error parsing file`, result.error);
      return false;
    }

    try {
      // TODO: validation?
      indexDataForgedData(
        this.index,
        file.path,
        result.priority ?? 1,
        result.rules,
      );
      return true;
    } catch (e) {
      console.error(`[file: ${file.path}] error indexing file`, e);
      return false;
    }
  }

  async indexPluginFile(
    normalizedPath: string,
    priority: number,
    format: string = "json",
  ): Promise<void> {
    console.log(
      "forged: datastore: indexing plugin file %s (format: %s priority: %d)",
      normalizedPath,
      format,
      priority,
    );
    const content = await this.app.vault.adapter.read(normalizedPath);
    // TODO: validate
    let data: RulesPackage;
    if (format === "json") {
      data = JSON.parse(content) as RulesPackage;
    } else if (format === "yaml") {
      data = parseYaml(content) as RulesPackage;
    } else {
      throw new Error(`unknown file type ${format}`);
    }
    indexDataForgedData(this.index, normalizedPath, priority, data);
    this.index.updateIndexGroup(normalizedPath, new Set([normalizedPath]));

    this.app.metadataCache.trigger("forged:index-changed");
  }

  get ready(): boolean {
    return this._ready;
  }

  // get data(): Starforged | undefined {
  //   return this._data;
  // }

  get moves(): Move[] {
    this.assertReady();
    return [...this.index._moveIndex.values()];
  }

  get oracles(): StandardIndex<Oracle> {
    this.assertReady();
    return this.index._oracleIndex;
  }

  get assets(): StandardIndex<Asset> {
    this.assertReady();
    return this.index._assetIndex;
  }

  get roller(): OracleRoller {
    return new OracleRoller(this.oracles);
  }

  get ruleset(): Ruleset {
    this.assertReady();
    const ruleset = this.index._rulesetIndex.get(this.activeRuleset);
    if (!ruleset) {
      throw new Error(`missing ruleset ${this.activeRuleset}`);
    }
    return ruleset;
  }

  private assertReady(): void {
    if (!this._ready) {
      throw new Error("data not loaded yet");
    }
  }
}
