import { Datasworn } from "@datasworn/core";
import merge from "lodash.merge";
import {
  Oracle,
  OracleCollectionGrouping,
  OracleGrouping,
  OracleGroupingType,
  OracleRulesetGrouping,
} from "model/oracle";
import {
  DataIndex,
  DataIndexer,
  PreSourced,
  PreSourcedBy,
  Source,
  SourcedBy,
} from "./data-indexer";
import { moveOrigin, scopeSource, scopeTags } from "./datasworn-symbols";
import { DataswornOracle } from "./parsers/datasworn/oracles";

export type MoveWithSelector = Datasworn.AnyMove & {
  [moveOrigin]: { assetId?: Datasworn.AssetId };
};

export type WithMetadata<T> = T & {
  [scopeTags]: Datasworn.Tags;
  [scopeSource]: Datasworn.SourceInfo;
};

export type AllWithMetadata<T> = {
  [K in keyof T]: WithMetadata<T[K]>;
};

export type DataswornTypes = AllWithMetadata<{
  move_category: Datasworn.MoveCategory;
  move: MoveWithSelector;
  asset: Datasworn.Asset;
  oracle: Oracle;
  rules_package: Datasworn.RulesPackage;
  truth: Datasworn.Truth;
}>;

export type AnyDataswornMove = DataswornTypes["move"];

export type DataswornSourced = SourcedBy<DataswornTypes>;

export type AnyDataswornSourced = DataswornSourced;

export type DataswornIndexer = DataIndexer<DataswornTypes>;

export function createSource(fields: {
  path: string;
  priority?: number;
}): Source {
  return {
    path: fields.path,
    priority: fields.priority ?? 0,
    keys: new Set(),
  };
}

export function* walkDataswornRulesPackage(
  input: Datasworn.RulesPackage,
): Iterable<PreSourcedBy<DataswornTypes>> {
  function make<T extends { _id: string; type: string }>(
    obj: T,
    source: Datasworn.SourceInfo,
    tags: Datasworn.Tags,
  ): PreSourced<T["type"], WithMetadata<T>> {
    return {
      id: obj._id,
      kind: obj.type,
      value: {
        ...obj,
        [scopeSource]: source,
        [scopeTags]: tags,
      },
    };
  }

  const rootGrouping: OracleRulesetGrouping = {
    id: input._id,
    name: input.title ?? input._id,
    grouping_type: OracleGroupingType.Ruleset,
  };

  for (const [, category] of Object.entries(input.moves ?? {})) {
    const categoryTags = category.tags ?? {};
    yield make(category, category._source, categoryTags);

    for (const [, move] of Object.entries(category.contents ?? {})) {
      const moveTags = merge({}, categoryTags, move.tags ?? {});
      yield make({ ...move, [moveOrigin]: {} }, move._source, moveTags);

      const moveOracleGroup: OracleCollectionGrouping = {
        // TODO(@cwegrzyn): should this be its own grouping type? and what should the path be?
        grouping_type: OracleGroupingType.Collection,
        name: move.name,
        parent: rootGrouping,
        id: move._id,
        [scopeSource]: move._source,
        [scopeTags]: moveTags,
      };
      for (const [, oracle] of Object.entries(move.oracles ?? {})) {
        const oracleTags = merge({}, moveTags, oracle.tags ?? {});
        yield {
          id: oracle._id,
          kind: "oracle",
          value: new DataswornOracle(oracle, moveOracleGroup, oracleTags),
        };
      }
    }
  }

  for (const [, assetCollection] of Object.entries(input.assets ?? {})) {
    const collectionTags = assetCollection.tags ?? {};

    for (const [, asset] of Object.entries(assetCollection.contents ?? {})) {
      const assetTags = merge({}, collectionTags, asset.tags ?? {});
      yield make(asset, asset._source, assetTags);

      for (const ability of asset.abilities) {
        const abilityTags = merge({}, assetTags, ability.tags ?? {});

        for (const [, move] of Object.entries(ability.moves ?? {})) {
          const moveTags = merge({}, abilityTags, move.tags);

          yield make(
            { ...move, [moveOrigin]: { assetId: asset._id } },
            asset._source,
            moveTags,
          );
        }
      }
    }
  }

  for (const oracle of walkOracles(input)) {
    yield { id: oracle.id, kind: "oracle", value: oracle };
  }

  for (const truth of Object.values(input.truths ?? {})) {
    yield {
      id: truth._id,
      kind: "truth",
      value: {
        ...truth,
        [scopeSource]: truth._source,
        [scopeTags]: truth.tags ?? {},
      },
    };
  }

  yield {
    id: input._id,
    kind: "rules_package",
    value: {
      ...input,
      [scopeSource]: {
        authors: input.authors,
        date: input.date,
        license: input.license,
        title: input.title,
        url: input.url,
      },
      [scopeTags]: {},
    },
  };
}

function* walkOracles(data: Datasworn.RulesPackage): Generator<Oracle> {
  function* expand(
    collection: Datasworn.OracleCollection,
    parent: OracleGrouping,
  ): Generator<Oracle> {
    const newParent: OracleCollectionGrouping = {
      grouping_type: OracleGroupingType.Collection,
      name: collection.name,
      parent,
      id: collection._id,
      [scopeSource]: collection._source,
      [scopeTags]: merge(
        {},
        parent.grouping_type == OracleGroupingType.Collection
          ? parent[scopeTags]
          : {},
        collection.tags ?? {},
      ),
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
            yield new DataswornOracle(
              oracle,
              newParent,
              merge({}, newParent[scopeTags], oracle.tags ?? {}),
            );
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
export type DataswornIndex = DataIndex<DataswornTypes>;

/** Returns the source info of move or its nearest parent */
export function scopeSourceForMove(
  move: DataswornTypes["move"],
): Datasworn.SourceInfo {
  return move[scopeSource];
}
