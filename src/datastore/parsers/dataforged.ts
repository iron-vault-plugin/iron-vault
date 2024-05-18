import { type Datasworn } from "@datasworn/core";
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
  ruleset: Datasworn.RulesPackage,
): void {
  index.indexSource(normalizedPath, priority, {
    oracles: indexIntoOracleMap(ruleset),
    moveCategories: Object.entries(ruleset.moves ?? {}),
    moves: Object.values(ruleset.moves ?? {}).flatMap(
      (category): Array<[string, Datasworn.Move]> =>
        Object.values(category.contents ?? {}).map((m) => [m._id, m]),
    ),
    assets: Object.values(ruleset.assets ?? {}).flatMap(
      (category): Array<[string, Datasworn.Asset]> =>
        Object.values(category.contents ?? {}).map((asset) => [
          asset._id,
          asset,
        ]),
    ),
    // TODO: we should also be able to index ruleset expansions, but that's not currently supported by this
    rulesets:
      ruleset.type == "ruleset"
        ? { [ruleset._id]: new Ruleset(ruleset._id, ruleset.rules) }
        : {},
  });
}

type OracleMap = Map<string, Oracle>;

export function indexIntoOracleMap(data: Datasworn.RulesPackage): OracleMap {
  const index: OracleMap = new Map();
  function expand(
    collection: Datasworn.OracleCollection,
    parent: OracleGrouping,
  ): void {
    const newParent: OracleCollectionGrouping = {
      grouping_type: OracleGroupingType.Collection,
      name: collection.name,
      parent,
      id: collection._id,
    };
    // TODO: do we need/want to handle any of these differently? Main thing might be
    // different grouping types, so we can adjust display in some cases?
    // Like, grouping Ask The Oracle results-- but then we'd need to index Ask The Oracle
    // instead of the individual tables
    switch (collection.oracle_type) {
      case "tables":
      case "table_shared_rolls":
      case "table_shared_text":
      case "table_shared_text2":
      case "table_shared_text3":
        if (collection.contents != null) {
          for (const oracle of Object.values<Datasworn.OracleRollable>(
            collection.contents,
          )) {
            index.set(oracle._id, new DataswornOracle(oracle, newParent));
          }
        }

        break;
      default: {
        const invalid: never = collection;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        throw new Error(`unexpected type ${(invalid as any).oracle_type}`);
      }
    }

    if ("collections" in collection) {
      for (const [, set] of Object.entries(collection.collections ?? {})) {
        expand(set, newParent);
      }
    }
  }
  const rootGrouping: OracleRulesetGrouping = {
    id: data._id,
    name: data.title ?? data._id,
    grouping_type: OracleGroupingType.Ruleset,
  };

  for (const [, set] of Object.entries(data.oracles ?? {})) {
    expand(set, rootGrouping);
  }
  return index;
}
