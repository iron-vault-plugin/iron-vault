import {
  createMeasureSetImpl,
  IronswornCharacterAsset,
  IronswornCharacterMetadata,
  type MeasureSet,
  type MeasureSpec,
} from "./character";
import { DataIndex } from "./datastore/data-index";

describe("MeasureSetImpl", () => {
  const MeasureSpec: MeasureSpec = {
    heart: { dataPath: "heart", id: "heart", kind: "stat", label: "Heart" },
    momentum: {
      dataPath: "momentum",
      id: "momentum",
      kind: "meter",
      label: "Momentum",
    },
  };
  const [_ReadonlyMeasureSetImpl, MeasureSetImpl] =
    createMeasureSetImpl(MeasureSpec);

  const data = {
    heart: 2,
    momentum: "1",
  };

  let measureSet: MeasureSet<MeasureSpec, any>;

  beforeEach(() => {
    measureSet = new MeasureSetImpl(data, (data) => data);
  });

  describe("keys", () => {
    test("lists all of the keys", () => {
      expect(measureSet.keys()).toEqual(["heart", "momentum"]);
    });
  });

  describe("value", () => {
    test("parses a string", () => {
      expect(measureSet.value("momentum")).toEqual(1);
    });

    test("returns the value", () => {
      expect(measureSet.value("heart")).toEqual(2);
    });
  });

  describe("set", () => {
    test("builds a new object with updated data", () => {
      const newData = measureSet.set("momentum", 3);
      expect(newData).toEqual(Object.assign({}, data, { momentum: 3 }));
    });

    test("does not modify the original object", () => {
      measureSet.set("momentum", 3);
      expect(measureSet.value("momentum")).toEqual(1);
    });
  });

  test("entries returns all values", () => {
    expect(measureSet.entries()).toEqual([
      { key: "heart", value: 2, definition: MeasureSpec.heart },
      { key: "momentum", value: 1, definition: MeasureSpec.momentum },
    ]);
  });
});

describe("IronswornCharacterMetadata", () => {
  const mockIndex = new DataIndex();

  beforeAll(() => {
    mockIndex.indexSource("test", 1, {
      oracles: {},
      moves: {},
      assets: {
        "test/asset1": {
          $id: "test/asset1",
          Abilities: [
            {
              Moves: [
                {
                  $id: "test/asset1/moves/move1",
                  Title: {
                    $id: "test/asset1/moves/move1",
                    Canonical: "Test Move",
                    Standard: "Test Move",
                    Short: "Test Move",
                  },
                  Category: "Test",
                },
              ],
            },
            {
              Moves: [
                {
                  $id: "test/asset1/moves/move2",
                  Title: {
                    $id: "test/asset1/moves/move1",
                    Canonical: "Test Move 2",
                    Standard: "Test Move 2",
                    Short: "Test Move 2",
                  },
                  Category: "Test",
                },
              ],
            },
          ],
        },
      },
    });
  });

  // describe("measures", () => {
  //   it("gets value for a specific measure", () => {
  //     new IronswornCharacterMetadata({ heart: 1 }, mockIndex);
  //   });
  //   it("sets a value", () => {});
  // });

  describe("moves", () => {
    it("is empty if no assets", () => {
      expect(new IronswornCharacterMetadata({}, mockIndex).moves).toEqual([]);
    });
    it("does not include moves for unmarked asset abilities", () => {
      expect(
        new IronswornCharacterMetadata(
          { assets: [{ id: "test/asset1" }] as IronswornCharacterAsset[] },
          mockIndex,
        ).moves,
      ).toEqual([]);
    });
    it("includes moves for marked asset abilities", () => {
      expect(
        new IronswornCharacterMetadata(
          {
            assets: [
              { id: "test/asset1", marked_abilities: [1] },
            ] as IronswornCharacterAsset[],
          },
          mockIndex,
        ).moves,
      ).toMatchObject([{ $id: "test/asset1/moves/move1" }]);

      expect(
        new IronswornCharacterMetadata(
          {
            assets: [
              { id: "test/asset1", marked_abilities: [1, 2] },
            ] as IronswornCharacterAsset[],
          },
          mockIndex,
        ).moves,
      ).toMatchObject([
        { $id: "test/asset1/moves/move1" },
        { $id: "test/asset1/moves/move2" },
      ]);
    });
  });
});
