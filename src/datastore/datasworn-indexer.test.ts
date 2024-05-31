import { Datasworn } from "@datasworn/core";
import starforgedPackage from "@datasworn/starforged/json/starforged.json" with { type: "json" };
import { OracleGrouping, OracleGroupingType } from "model/oracle";
import { DataIndexer, Source, assertIsKind } from "./data-indexer";
import {
  DataswornIndexer,
  DataswornTypes,
  moveOrigin,
  walkDataswornRulesPackage,
} from "./datasworn-indexer";

describe("Datasworn Indexer", () => {
  const createIndex = () => {
    const source: Source = {
      path: "@datasworn/starforged",
      priority: 0,
      keys: new Set(),
      sourceTags: { "ruleset-id": Symbol.for(starforgedPackage._id) },
    };
    const indexer: DataswornIndexer = new DataIndexer();
    indexer.index(
      source,
      walkDataswornRulesPackage(
        source,
        starforgedPackage as Datasworn.RulesPackage,
      ),
    );
    return indexer;
  };

  const indexer = createIndex();

  it("should index moves", () => {
    const [faceDanger] =
      indexer.dataMap.get("starforged/moves/adventure/face_danger") ?? [];

    expect(faceDanger).toMatchObject({
      id: "starforged/moves/adventure/face_danger",
      kind: "move",
      source: { path: "@datasworn/starforged" },
      value: starforgedPackage.moves.adventure.contents.face_danger,
    });

    assertIsKind<DataswornTypes, "move">(faceDanger, "move");

    expect(faceDanger.value[moveOrigin].assetId).toBeUndefined();
  });

  it("should index assets", () => {
    expect(indexer.dataMap.get("starforged/assets/path/empath")).toMatchObject([
      {
        id: "starforged/assets/path/empath",
        kind: "asset",
        source: { path: "@datasworn/starforged" },
        value: starforgedPackage.assets.path.contents.empath,
      },
    ]);
  });

  it("should index asset-linked-moves", () => {
    const [readHeart] = indexer.dataMap.get(
      "starforged/assets/path/empath/abilities/0/moves/read_heart",
    )!;
    expect(readHeart).toMatchObject({
      id: "starforged/assets/path/empath/abilities/0/moves/read_heart",
      kind: "move",
      source: { path: "@datasworn/starforged" },
      value:
        starforgedPackage.assets.path.contents.empath.abilities[0].moves
          ?.read_heart,
    });

    assertIsKind<DataswornTypes, "move">(readHeart, "move");

    expect(readHeart.value[moveOrigin]).toEqual({
      assetId: "starforged/assets/path/empath",
    });
  });

  it("should add keys to source", () => {
    expect(
      indexer.dataMap.get("starforged/moves/adventure/face_danger")?.at(0)
        ?.source.keys,
    ).toContain("starforged/moves/adventure/face_danger");
  });

  it("indexes included starforged data", () => {
    expect(
      indexer.dataMap.get("starforged/oracles/core/action")?.at(0),
    ).toHaveProperty("id", "starforged/oracles/core/action");
  });

  it("indexes each Ask The Oracle entry", () => {
    const almostCertain = indexer.dataMap.get(
      "starforged/oracles/moves/ask_the_oracle/almost_certain",
    )![0];
    assertIsKind<DataswornTypes, "oracle">(almostCertain, "oracle");
    expect(almostCertain.value.name).toEqual("Almost Certain");
    expect(almostCertain.value.parent).toEqual<OracleGrouping>({
      grouping_type: OracleGroupingType.Collection,
      id: "starforged/collections/oracles/moves/ask_the_oracle",
      name: "Ask the Oracle",
      parent: {
        grouping_type: OracleGroupingType.Collection,
        id: "starforged/collections/oracles/moves",
        name: "Move Oracles",
        parent: {
          grouping_type: OracleGroupingType.Ruleset,
          id: "starforged",
          name: "Ironsworn: Starforged Rulebook",
        },
      },
    });
  });

  it.todo("replaces content from the same source");
  it.todo("increases the revision number");
});
