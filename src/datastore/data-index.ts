import { Asset, type Move, type OracleSet, type OracleTable } from "dataforged";
import { IndexableData, PriorityIndexer } from "./priority-index";

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

export class DataIndex {
  _oracleIndex: OracleIndex;
  _moveIndex: PriorityIndexer<string, Move>;
  _assetIndex: PriorityIndexer<string, Asset>;

  /** Tracks "groups" of sources that should be updated together.  */
  _indexGroups: Map<string, Set<string>>;

  constructor() {
    this._oracleIndex = new OracleIndex();
    this._moveIndex = new PriorityIndexer();
    this._assetIndex = new PriorityIndexer();
    this._indexGroups = new Map();
  }

  updateIndexGroup(group: string, indexedPaths: Set<string>): Set<string> {
    const existingPaths = this._indexGroups.get(group) ?? new Set();
    const pathsToRemove = new Set(
      [...existingPaths].filter((prevPath) => !indexedPaths.has(prevPath)),
    );

    for (const pathToRemove of pathsToRemove) {
      this.removeSource(pathToRemove);
    }

    this._indexGroups.set(group, indexedPaths);

    return pathsToRemove;
  }

  removeSource(pathToRemove: string) {
    this._oracleIndex.removeSource(pathToRemove);
    this._moveIndex.removeSource(pathToRemove);
    this._assetIndex.removeSource(pathToRemove);
  }

  indexSource(
    normalizedPath: string,
    priority: number,
    data: {
      oracles: IndexableData<string, OracleSet | OracleTable>;
      moves: IndexableData<string, Move>;
      assets: IndexableData<string, Asset>;
    },
  ): void {
    this._oracleIndex.indexSource(normalizedPath, priority, data.oracles);
    this._moveIndex.indexSource(normalizedPath, priority, data.moves);
    this._assetIndex.indexSource(normalizedPath, priority, data.assets);
  }
}
