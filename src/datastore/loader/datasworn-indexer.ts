import { Datasworn } from "@datasworn/core";
import { Entry, EntryTypes, WithoutPath } from "datastore/db";
import merge from "lodash.merge";

export type DataswornEntries = EntryTypes<DataswornTypes>[keyof DataswornTypes];
export type Metadata = Readonly<{
  tags: Readonly<Datasworn.Tags>;
  source: Readonly<Datasworn.SourceInfo>;
  ancestors: readonly Datasworn.AnyId[];
}>;

export type MoveMetadata = Metadata &
  Readonly<{
    moveOrigin: { readonly assetId?: Datasworn.AssetId };
  }>;

export type WithMetadata<T, M extends Metadata> = Readonly<{
  metadata: M;
  data: T;
}>;

export type AllWithMetadata<T> = {
  [K in keyof T]: T[K] extends WithMetadata<infer U, infer M>
    ? WithMetadata<U, M>
    : WithMetadata<T[K], Metadata>;
};

export type DataswornTypes = AllWithMetadata<{
  move_category: Datasworn.MoveCategory;
  move: WithMetadata<Datasworn.AnyMove, MoveMetadata>;
  asset: Datasworn.Asset;
  oracle_rollable: Omit<Datasworn.OracleRollable, "source">;
  oracle_collection: Datasworn.OracleCollection;
  rules_package: Datasworn.RulesPackage;
  truth: Datasworn.Truth;
}>;

export type AnyDataswornMove = DataswornTypes["move"];

function mergeMetadata<M extends Partial<Metadata>>(
  parent: Metadata,
  child: M,
): M & Metadata {
  return {
    ...child,
    tags: merge({}, parent.tags, child.tags ?? {}),
    source: child.source ?? parent.source,
    ancestors: [...parent.ancestors, ...(child.ancestors ?? [])],
  };
}

function make<T extends { _id: string; type: string }, M extends Metadata>(
  data: T,
  metadata: M,
): WithoutPath<Entry<T["type"], WithMetadata<T, M>>> {
  return {
    id: data._id,
    kind: data.type,
    value: {
      metadata,
      data,
    },
  };
}

export function* walkDataswornRulesPackage(
  input: Datasworn.RulesPackage,
): Iterable<WithoutPath<DataswornEntries>> {
  for (const [, category] of Object.entries(input.moves ?? {})) {
    const categoryMetadata = {
      tags: category.tags ?? {},
      source: category._source,
      ancestors: [input._id],
    };
    yield make(category, categoryMetadata);

    for (const [, move] of Object.entries(category.contents ?? {})) {
      const moveMetadata: MoveMetadata = mergeMetadata(categoryMetadata, {
        tags: move.tags,
        source: move._source,
        ancestors: [category._id],
        moveOrigin: {},
      });
      yield make(move, moveMetadata);

      // TODO: I'm not immediately giving moves any kind of reified grouping in this
      // new model. So this is to mark that I have to deal with this down the line
      // and figure out how to handle the grouping of moves in the new model.
      // const moveOracleGroup: OracleCollectionGrouping = {
      //   // TODO(@cwegrzyn): should this be its own grouping type? and what should the path be?
      //   grouping_type: OracleGroupingType.Collection,
      //   name: move.name,
      //   parent: rootGrouping,
      //   id: move._id,
      //   [scopeSource]: move._source,
      //   [scopeTags]: moveTags,
      // };
      for (const [, oracle] of Object.entries(move.oracles ?? {})) {
        const oracleMetadata = mergeMetadata(moveMetadata, {
          tags: oracle.tags,
          ancestors: [move._id],
        });
        yield make(oracle, oracleMetadata);
      }
    }
  }

  for (const [, assetCollection] of Object.entries(input.assets ?? {})) {
    // TODO: probably we should index the asset collection itself too?
    const collectionTags = assetCollection.tags ?? {};
    const collectionMetadata = {
      tags: collectionTags,
      source: assetCollection._source,
      ancestors: [input._id],
    };

    for (const [, asset] of Object.entries(assetCollection.contents ?? {})) {
      const assetMetadata = mergeMetadata(collectionMetadata, {
        tags: asset.tags,
        source: asset._source,
        ancestors: [assetCollection._id],
      });
      yield make(asset, assetMetadata);

      for (const ability of asset.abilities) {
        const abilityMetadata = mergeMetadata(assetMetadata, {
          tags: ability.tags,
          ancestors: [asset._id],
        });

        for (const [, move] of Object.entries(ability.moves ?? {})) {
          // Don't add an ancestor here, since we don't want the ability in the
          // ancestor list for the move from a hierarchical perspective
          const moveMetadata = mergeMetadata(abilityMetadata, {
            tags: move.tags,
            moveOrigin: { assetId: asset._id },
          });

          yield make(move, moveMetadata);
        }
      }
    }
  }

  const rootMetadata = {
    tags: {},
    source: {
      authors: input.authors,
      date: input.date,
      license: input.license,
      title: input.title,
      url: input.url,
    },
    ancestors: [],
  };

  const rootChildMetadata = mergeMetadata(rootMetadata, {
    ancestors: [input._id],
  });

  yield* walkOracles(input, rootChildMetadata);

  for (const truth of Object.values(input.truths ?? {})) {
    yield make(truth, {
      tags: truth.tags ?? {},
      source: truth._source,
      ancestors: [input._id],
    });
  }

  yield {
    id: input._id,
    kind: "rules_package",
    value: {
      metadata: rootChildMetadata,
      data: input,
    },
  };
}

function* walkOracles(
  data: Datasworn.RulesPackage,
  rootMetadata: Metadata,
): Generator<
  WithoutPath<
    EntryTypes<DataswornTypes>["oracle_collection" | "oracle_rollable"]
  >
> {
  function* expand(
    collection: Datasworn.OracleCollection,
    parent: Metadata,
  ): Generator<
    WithoutPath<
      EntryTypes<DataswornTypes>["oracle_collection" | "oracle_rollable"]
    >
  > {
    const collectionMetadata = mergeMetadata(parent, {
      tags: collection.tags ?? {},
      source: collection._source,
      ancestors: [],
    });

    yield make(collection, collectionMetadata);

    const childBaseMetadata = mergeMetadata(collectionMetadata, {
      ancestors: [collection._id],
    });

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
            const oracleMetadata = mergeMetadata(childBaseMetadata, {
              tags: oracle.tags,
              source: "_source" in oracle ? oracle["_source"] : undefined,
            });
            yield make(oracle, oracleMetadata);
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
        yield* expand(set, childBaseMetadata);
      }
    }
  }
  for (const [, set] of Object.entries(data.oracles ?? {})) {
    yield* expand(set, rootMetadata);
  }
}
