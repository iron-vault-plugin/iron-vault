import { Datasworn } from "@datasworn/core";
import IronVaultPlugin from "index";
import {
  Oracle,
  OracleCollectionGrouping,
  OracleGrouping,
  OracleGroupingType,
  OracleRulesetGrouping,
} from "model/oracle";
import {
  DataIndexer,
  Source,
  SourceTag,
  Sourced,
  SourcedBy,
} from "./data-indexer";
import { DataswornOracle } from "./parsers/datasworn/oracles";

export const moveOrigin: unique symbol = Symbol("moveOrigin");

export type AnyDataswornMove = Datasworn.Move | Datasworn.EmbeddedMove;
export type MoveWithSelector = AnyDataswornMove & {
  [moveOrigin]: { assetId?: Datasworn.AssetId };
};

export type DataswornTypes = {
  move_category: Datasworn.MoveCategory;
  move_ruleset: Datasworn.RulesPackage;
  move: MoveWithSelector;
  asset: Datasworn.Asset;
  oracle: Oracle;
  rules_package: Datasworn.RulesPackage;
  truth: Datasworn.Truth;
};

export type DataswornSourced = SourcedBy<DataswornTypes>;

export type AnyDataswornSourced = DataswornSourced;

export type DataswornIndexer = DataIndexer<DataswornTypes>;

export function createSource(fields: {
  path: string;
  priority?: number;
  sourceTags: Partial<Record<SourceTag, string | symbol>>;
}): Source {
  return {
    path: fields.path,
    priority: fields.priority ?? 0,
    keys: new Set(),
    sourceTags: Object.fromEntries(
      Object.entries(fields.sourceTags).map(([key, val]) => [
        key,
        typeof val == "symbol" ? val : Symbol.for(val),
      ]),
    ),
  };
}

export function* walkDataswornRulesPackage(
  source: Source,
  input: Datasworn.RulesPackage,
  plugin?: IronVaultPlugin,
): Iterable<DataswornSourced> {
  function make<T extends { _id: string; type: string }>(
    obj: T,
  ): Sourced<T["type"], T> {
    return { source, id: obj._id, kind: obj.type, value: obj };
  }

  const rootGrouping: OracleRulesetGrouping = {
    id: input._id,
    name: input.title ?? input._id,
    grouping_type: OracleGroupingType.Ruleset,
  };

  for (const [, category] of Object.entries(input.moves ?? {})) {
    yield make(category);

    for (const [, move] of Object.entries(category.contents ?? {})) {
      yield make({ ...move, [moveOrigin]: {} });
      yield {
        id: "ruleset_for_" + move._id,
        kind: "move_ruleset",
        value: input,
        source,
      };

      const moveOracleGroup: OracleCollectionGrouping = {
        // TODO(@cwegrzyn): should this be its own grouping type? and what should the path be?
        grouping_type: OracleGroupingType.Collection,
        name: move.name,
        parent: rootGrouping,
        id: move._id,
      };
      for (const [, oracle] of Object.entries(move.oracles ?? {})) {
        yield {
          id: oracle._id,
          kind: "oracle",
          value: new DataswornOracle(oracle, moveOracleGroup, plugin),
          source,
        };
      }
    }
  }

  for (const [, assetCollection] of Object.entries(input.assets ?? {})) {
    for (const [, asset] of Object.entries(assetCollection.contents ?? {})) {
      yield make(asset);

      for (const ability of asset.abilities) {
        for (const [, move] of Object.entries(ability.moves ?? {})) {
          yield make({ ...move, [moveOrigin]: { assetId: asset._id } });
          yield {
            id: "ruleset_for_" + move._id,
            kind: "move_ruleset",
            value: input,
            source,
          };
        }
      }
    }
  }

  for (const oracle of walkOracles(input, plugin)) {
    yield { id: oracle.id, kind: "oracle", value: oracle, source };
  }

  for (const truth of Object.values(input.truths ?? {})) {
    yield { id: truth._id, kind: "truth", value: truth, source };
  }

  yield { id: input._id, kind: "rules_package", value: input, source };
}

function* walkOracles(
  data: Datasworn.RulesPackage,
  plugin?: IronVaultPlugin,
): Generator<Oracle> {
  function* expand(
    collection: Datasworn.OracleCollection,
    parent: OracleGrouping,
  ): Generator<Oracle> {
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
            yield new DataswornOracle(oracle, newParent, plugin);
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
        yield* expand(set, newParent);
      }
    }
  }
  const rootGrouping: OracleRulesetGrouping = {
    id: data._id,
    name: data.title ?? data._id,
    grouping_type: OracleGroupingType.Ruleset,
  };

  for (const [, set] of Object.entries(data.oracles ?? {})) {
    yield* expand(set, rootGrouping);
  }
}
