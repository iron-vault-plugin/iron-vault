import { Datasworn } from "@datasworn/core";
import starforgedPackage from "@datasworn/starforged/json/starforged.json" with { type: "json" };
import { OracleGrouping, OracleGroupingType } from "model/oracle";
import { assertIsKind, DataIndexer, Source } from "./data-indexer";
import {
  createSource,
  DataswornIndexer,
  DataswornTypes,
  moveOrigin,
  walkDataswornRulesPackage,
} from "./datasworn-indexer";

describe("Datasworn Indexer", () => {
  const createIndex = () => {
    const source: Source = createSource({
      path: "@datasworn/starforged",
      priority: 0,
    });
    const indexer: DataswornIndexer = new DataIndexer();
    indexer.index(
      source,
      walkDataswornRulesPackage(
        source,
        // @ts-expect-error tsc compiler seems to infer starforged JSON types weirdly
        starforgedPackage as Datasworn.RulesPackage,
      ),
    );
    return indexer;
  };

  const indexer = createIndex();

  it("should index moves", () => {
    const [faceDanger] =
      indexer.dataMap.get("move:starforged/adventure/face_danger") ?? [];

    expect(faceDanger).toMatchObject({
      id: "move:starforged/adventure/face_danger",
      kind: "move",
      source: { path: "@datasworn/starforged" },
      value: starforgedPackage.moves.adventure.contents.face_danger,
    });

    assertIsKind<DataswornTypes, "move">(faceDanger, "move");

    expect(faceDanger.value[moveOrigin].assetId).toBeUndefined();
  });

  it("should index assets", () => {
    expect(indexer.dataMap.get("asset:starforged/path/empath")).toMatchObject([
      {
        id: "asset:starforged/path/empath",
        kind: "asset",
        source: { path: "@datasworn/starforged" },
        value: starforgedPackage.assets.path.contents.empath,
      },
    ]);
  });

  it("should index asset-linked-moves", () => {
    const [readHeart] = indexer.dataMap.get(
      "asset.ability.move:starforged/path/empath.0.read_heart",
    )!;
    expect(readHeart).toMatchObject({
      id: "asset.ability.move:starforged/path/empath.0.read_heart",
      kind: "move",
      source: { path: "@datasworn/starforged" },
      value:
        starforgedPackage.assets.path.contents.empath.abilities[0].moves
          ?.read_heart,
    });

    assertIsKind<DataswornTypes, "move">(readHeart, "move");

    expect(readHeart.value[moveOrigin]).toEqual({
      assetId: "asset:starforged/path/empath",
    });
  });

  it("should add keys to source", () => {
    expect(
      indexer.dataMap.get("move:starforged/adventure/face_danger")?.at(0)
        ?.source.keys,
    ).toContain("move:starforged/adventure/face_danger");
  });

  it("indexes included starforged data", () => {
    expect(
      indexer.dataMap.get("oracle_rollable:starforged/core/action")?.at(0),
    ).toHaveProperty("id", "oracle_rollable:starforged/core/action");
  });

  it("indexes each Ask The Oracle entry", () => {
    const almostCertain = indexer.dataMap.get(
      "move.oracle_rollable:starforged/fate/ask_the_oracle.almost_certain",
    )![0];
    assertIsKind<DataswornTypes, "oracle">(almostCertain, "oracle");
    expect(almostCertain.value.name).toEqual("Almost Certain");
    expect(almostCertain.value.parent).toEqual<OracleGrouping>({
      grouping_type: OracleGroupingType.Collection,
      id: "move:starforged/fate/ask_the_oracle",
      name: "Ask the Oracle",
      parent: {
        grouping_type: OracleGroupingType.Ruleset,
        id: "starforged",
        name: "Ironsworn: Starforged Rulebook",
      },
    });
  });

  it.todo("replaces content from the same source");
  it.todo("increases the revision number");
});
