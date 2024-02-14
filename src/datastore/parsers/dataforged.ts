import { Asset, Move, OracleCollection, RulesPackage } from "@datasworn/core";
import { DataIndex } from "../../datastore/data-index";
import {
  Oracle,
  OracleCollectionGrouping,
  OracleGrouping,
  OracleGroupingType,
  OracleRulesetGrouping,
} from "../../model/oracle";
import { Ruleset } from "../../rules/ruleset";
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
    // TODO: we should also be able to index ruleset expansions, but that's not currently supported by this
    rulesets:
      ruleset.package_type == "ruleset"
        ? { [ruleset.id]: new Ruleset(ruleset.id, ruleset.rules) }
        : {},
  });
}

type OracleMap = Map<string, Oracle>;

export function indexIntoOracleMap(data: RulesPackage): OracleMap {
  const index: OracleMap = new Map();
  function expand(collection: OracleCollection, parent: OracleGrouping): void {
    let newParent: OracleCollectionGrouping = {
      grouping_type: OracleGroupingType.Collection,
      name: collection.name,
      parent,
      id: collection.id,
    };
    // TODO: do we need/want to handle any of these differently? Main thing might be
    // different grouping types, so we can adjust display in some cases?
    // Like, grouping Ask The Oracle results-- but then we'd need to index Ask The Oracle
    // instead of the individual tables
    switch (collection.oracle_type) {
      case "tables":
      case "table_shared_results":
      case "table_shared_rolls":
      case "table_shared_details":
        if (collection.contents != null) {
          for (const [_name, oracle] of Object.entries(collection.contents)) {
            index.set(oracle.id, new DataswornOracle(oracle, newParent));
          }
        }

        break;
    }

    if ("collections" in collection) {
      for (const [, set] of Object.entries(collection.collections ?? {})) {
        expand(set, newParent);
      }
    }
  }
  const rootGrouping: OracleRulesetGrouping = {
    id: data.id,
    name: data.title ?? data.id,
    grouping_type: OracleGroupingType.Ruleset,
  };

  for (const [, set] of Object.entries(data.oracles ?? {})) {
    expand(set, rootGrouping);
  }
  return index;
}
