import {
  Asset,
  Move,
  OracleCollection,
  OracleRollable,
  RulesPackage,
} from "@datasworn/core";
import { DataIndex } from "datastore/data-index";

export function indexDataForgedData(
  index: DataIndex,
  normalizedPath: string,
  priority: number,
  ruleset: RulesPackage,
): void {
  index.indexSource(normalizedPath, priority, {
    oracles: indexIntoOracleMap(ruleset),
    moves: Object.values(ruleset.moves ?? {}).flatMap(
      (category): Array<[string, Move]> =>
        Object.values(category.contents ?? {}).map((m) => [m.id, m]),
    ),
    assets: Object.values(ruleset.assets ?? {}).flatMap(
      (category): Array<[string, Asset]> =>
        Object.values(category.contents ?? {}).map((asset) => [
          asset.id,
          asset,
        ]),
    ),
  });
}

type OracleMap = Map<string, OracleCollection | OracleRollable>;

export function indexIntoOracleMap(data: RulesPackage): OracleMap {
  const index = new Map();
  function expand(collection: OracleCollection): void {
    index.set(collection.id, collection);
    if (collection.contents != null) {
      for (const [_name, set] of Object.entries(collection.contents) satisfies [
        string,
        OracleRollable,
      ][]) {
        index.set(set.id, set);
      }
    }
    if (collection.oracle_type == "tables") {
      for (const [_name, set] of Object.entries(collection.collections ?? {})) {
        expand(set);
      }
    }
  }
  for (const [_name, set] of Object.entries(data.oracles ?? {})) {
    expand(set);
  }
  return index;
}
