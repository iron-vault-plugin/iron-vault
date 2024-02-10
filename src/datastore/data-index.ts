import { Asset, type Move } from "@datasworn/core";
import { Oracle } from "model/oracle";
import { Ruleset } from "rules/ruleset";
import { IndexableData, PriorityIndexer } from "./priority-index";

export class DataIndex {
  _oracleIndex: PriorityIndexer<string, Oracle>;
  _moveIndex: PriorityIndexer<string, Move>;
  _assetIndex: PriorityIndexer<string, Asset>;
  _rulesetIndex: PriorityIndexer<string, Ruleset>;

  /** Tracks "groups" of sources that should be updated together.  */
  _indexGroups: Map<string, Set<string>>;

  constructor() {
    this._oracleIndex = new PriorityIndexer();
    this._moveIndex = new PriorityIndexer();
    this._assetIndex = new PriorityIndexer();
    this._indexGroups = new Map();
    this._rulesetIndex = new PriorityIndexer();
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
    this._rulesetIndex.removeSource(pathToRemove);
  }

  indexSource(
    normalizedPath: string,
    priority: number,
    data: {
      oracles?: IndexableData<string, Oracle>;
      moves?: IndexableData<string, Move>;
      assets?: IndexableData<string, Asset>;
      rulesets?: IndexableData<string, Ruleset>;
    },
  ): void {
    this._oracleIndex.indexSource(normalizedPath, priority, data.oracles || {});
    this._moveIndex.indexSource(normalizedPath, priority, data.moves || {});
    this._assetIndex.indexSource(normalizedPath, priority, data.assets || {});
    this._rulesetIndex.indexSource(
      normalizedPath,
      priority,
      data.rulesets || {},
    );
  }
}
