import {
  type Move,
  type OracleBase,
  type OracleSet,
  type OracleTable,
  type Starforged,
} from "dataforged";
import { PriorityIndexer } from "datastore/priority-index";
import ForgedPlugin from "index";
import {
  Component,
  TAbstractFile,
  TFile,
  TFolder,
  parseYaml,
  type App,
} from "obsidian";
import { OracleRoller } from "oracles/roller";
import { breadthFirstTraversal } from "utils/traversal";

export { type Move };

type OracleMap = Map<string, OracleTable | OracleSet>;

function indexIntoOracleMap(data: Starforged): OracleMap {
  const index = new Map();
  function expand(oracleBase: OracleBase, prefix: string[]): void {
    index.set(oracleBase.$id, oracleBase);
    if (oracleBase.Sets != null) {
      for (const [name, set] of Object.entries(oracleBase.Sets)) {
        expand(set, prefix.concat([name]));
      }
    }
    if (oracleBase.Tables != null) {
      for (const [name, set] of Object.entries(oracleBase.Tables)) {
        expand(set, prefix.concat(name));
      }
    }
  }
  if (data?.["Oracle sets"] == null) {
    throw new Error("Oracle data seems to be missing");
  }
  for (const [name, set] of Object.entries(data["Oracle sets"])) {
    expand(set, [name]);
  }
  return index;
}

export class OracleIndex extends PriorityIndexer<
  string,
  OracleSet | OracleTable
> {
  *tables(): IterableIterator<OracleTable> {
    for (const table of this.values()) {
      if ("Table" in table) {
        yield table;
      }
    }
  }

  /**
   * Retrieve an oracle table from the index.
   * @param id ID of oracle table
   * @returns oracle table or undefined if the table is missing or is an OracleSet
   */
  getTable(id: string): OracleTable | undefined {
    const oracle = this.get(id);
    if (oracle == null || !("Table" in oracle)) {
      return undefined;
    }
    return oracle;
  }
}

export class Datastore extends Component {
  _oracleMap: OracleMap;
  _oracleIndex: OracleIndex;
  _moveIndex: PriorityIndexer<string, Move>;
  _ready: boolean;
  _indexedPaths: Map<string, Set<string>>;

  constructor(public readonly plugin: ForgedPlugin) {
    super();
    this._ready = false;

    this._oracleIndex = new OracleIndex();
    this._moveIndex = new PriorityIndexer();
    this._indexedPaths = new Map();
  }

  get app(): App {
    return this.plugin.app;
  }

  async initialize(): Promise<void> {
    const jsonPath = this.plugin.assetFilePath("starforged.json");
    // const supplementPath = this.plugin.assetFilePath(
    //   "starforged.supplement.yaml",
    // );
    await this.indexPluginFile(jsonPath, 0);
    // await this.indexPluginFile(supplementPath, -1, "yaml");
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
    this._ready = true;
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

    const existingPaths = this._indexedPaths.get(folder.path) ?? new Set();
    const pathsToRemove = new Set(
      [...existingPaths].filter((prevPath) => !indexedPaths.has(prevPath)),
    );

    for (const pathToRemove of pathsToRemove) {
      console.log(
        "index: previously indexed data file %s (part of %s) no longer indexable, removing...",
        pathToRemove,
        folder.path,
      );
      this._oracleIndex.removeSource(pathToRemove);
      this._moveIndex.removeSource(pathToRemove);
    }

    this._indexedPaths.set(folder.path, indexedPaths);
  }

  async indexOracleFile(file: TFile): Promise<boolean> {
    console.log("indexing %s", file.path);
    const cache = this.app.metadataCache.getFileCache(file);
    if (cache?.frontmatter?.forged !== "dataforged-inline") {
      return false;
    }

    const content = await this.app.vault.cachedRead(file);
    let matches = content.match(/^```[^\S\r\n]*dataforged\s?\n([\s\S]+?)^```/m);
    if (matches == null) {
      return false;
    }

    try {
      const data = parseYaml(matches[1]);
      // TODO: priority
      // TODO: validation?
      this.indexDataForgedData(file.path, 1, data as Starforged);
    } catch (e) {
      console.error("error loading file", file, e);
      return false;
    }

    return true;
  }

  indexDataForgedData(
    normalizedPath: string,
    priority: number,
    data: Starforged,
  ): void {
    this._oracleIndex.indexSource(
      normalizedPath,
      priority,
      indexIntoOracleMap(data),
    );
    this._moveIndex.indexSource(
      normalizedPath,
      priority,
      Object.values(data["Move categories"] ?? []).flatMap(
        (category): Array<[string, Move]> => {
          return Object.values(category.Moves).map((m) => {
            return [m.$id, m];
          });
        },
      ),
    );
  }

  async indexPluginFile(
    normalizedPath: string,
    priority: number,
    format: string = "json",
  ): Promise<void> {
    // const data = await this.app.vault.cachedRead(file);
    const content = await this.app.vault.adapter.read(normalizedPath);
    let data: Starforged;
    if (format === "json") {
      data = JSON.parse(content) as Starforged;
    } else if (format === "yaml") {
      data = parseYaml(content) as Starforged;
    } else {
      throw new Error(`unknown file type ${format}`);
    }
    this.indexDataForgedData(normalizedPath, priority, data);
    this._indexedPaths.set(normalizedPath, new Set([normalizedPath]));

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
    return [...this._moveIndex.values()];
  }

  get oracles(): OracleIndex {
    this.assertReady();
    return this._oracleIndex;
  }

  get roller(): OracleRoller {
    this.assertReady();
    return new OracleRoller(this._oracleIndex);
  }

  private assertReady(): void {
    if (!this._ready) {
      throw new Error("data not loaded yet");
    }
  }
}
