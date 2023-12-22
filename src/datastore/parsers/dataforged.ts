import { Asset, Move, OracleCollection, RulesPackage } from "@datasworn/core";
import { DataIndex } from "../../datastore/data-index";
import { Oracle } from "../../model/oracle";
import { DataswornOracle } from "./datasworn/oracles";

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

type OracleMap = Map<string, Oracle>;

export function indexIntoOracleMap(data: RulesPackage): OracleMap {
  const index: OracleMap = new Map();
  function expand(collection: OracleCollection, pathPrefix: string[]): void {
    switch (collection.oracle_type) {
      case "tables":
        if (collection.contents != null) {
          for (const [_name, oracle] of Object.entries(collection.contents)) {
            index.set(
              oracle.id,
              new DataswornOracle(
                oracle,
                collection.id,
                pathPrefix.join(" / "),
              ),
            );
          }
        }
        break;
      // TODO: maybe instead of expanding these tables out, we can support nesting in the menu
      // e.g., you pick Ask The Oracle -> then you pick the odds
      case "table_shared_results":
      case "table_shared_rolls":
      case "table_shared_details":
        if (collection.contents != null) {
          for (const [_name, oracle] of Object.entries(collection.contents)) {
            index.set(
              oracle.id,
              new DataswornOracle(
                oracle,
                collection.id,
                pathPrefix.join(" / "),
                collection.name,
              ),
            );
          }
        }
        break;
    }

    if ("collections" in collection) {
      for (const [, set] of Object.entries(collection.collections ?? {})) {
        expand(set, [...pathPrefix, set.name]);
      }
    }
  }
  for (const [, set] of Object.entries(data.oracles ?? {})) {
    expand(set, [set.name]);
  }
  return index;
}
