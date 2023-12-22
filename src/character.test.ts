import { Asset } from "@datasworn/core";
import {
  IronswornCharacterAsset,
  IronswornCharacterMetadata,
  createMeasureSetImpl,
  type MeasureSet,
  type MeasureSpec,
} from "./character";
import { DataIndex } from "./datastore/data-index";

// TODO: generate an actual test asset
const TestAsset: Asset = {
  id: "starforged/assets/path/empath",
  name: "Empath",
  category: "Path",
  color: "#3f7faa",
  count_as_impact: false,
  shared: false,
  abilities: [
    {
      id: "starforged/assets/path/empath/abilities/0",
      enabled: true,
      text: "When you read the intent, emotions, or memories of a nearby being, roll +heart. On a strong hit, you glimpse a helpful aspect of their inner self. Envision what you learn, take +2 momentum, and add +1 when you make moves to interact with them in this scene. On a weak hit, the visions are murky; take +1 momentum. On a miss, you reveal a troubling motive or secret; [Pay the Price](id:starforged/moves/fate/pay_the_price).",
      moves: {
        read_heart: {
          id: "starforged/assets/path/empath/abilities/0/moves/read_heart",
          name: "Read Heart",
          roll_type: "action_roll",
          trigger: {
            conditions: [
              {
                method: "player_choice",
                roll_options: [
                  {
                    using: "stat",
                    stat: "heart",
                  },
                ],
              },
            ],
            text: "When you read the intent, emotions, or memories of a nearby being...",
          },
          text: "When you read the intent, emotions, or memories of a nearby being, roll +heart. On a strong hit, you glimpse a helpful aspect of their inner self. Envision what you learn, take +2 momentum, and add +1 when you make moves to interact with them in this scene. On a weak hit, the visions are murky; take +1 momentum. On a miss, you reveal a troubling motive or secret; [Pay the Price](id:starforged/moves/fate/pay_the_price).",
          outcomes: {
            strong_hit: {
              text: "On a __strong hit__, you glimpse a helpful aspect of their inner self. Envision what you learn, take +2 momentum, and add +1 when you make moves to interact with them in this scene.",
            },
            weak_hit: {
              text: "On a __weak hit__, the visions are murky; take +1 momentum.",
            },
            miss: {
              text: "On a __miss__, you reveal a troubling motive or secret; [Pay the Price](id:starforged/moves/fate/pay_the_price).",
            },
          },
          source: {
            title: "Ironsworn: Starforged Assets",
            authors: [
              {
                name: "Shawn Tomkin",
              },
            ],
            date: "2022-05-06",
            url: "https://ironswornrpg.com",
            license: "https://creativecommons.org/licenses/by/4.0",
          },
        },
      },
    },
    {
      id: "starforged/assets/path/empath/abilities/1",
      enabled: false,
      text: "As above, and if you score a hit as you read them, you may subtly influence their attitude or actions, such as making a hostile being hesitate. Take another +1 momentum. If in a fight, mark progress.",
      enhance_moves: [
        {
          roll_type: "action_roll",
          enhances: [
            "starforged/assets/path/empath/abilities/0/moves/read_heart",
          ],
        },
      ],
    },
    {
      id: "starforged/assets/path/empath/abilities/2",
      enabled: false,
      text: "When you [Face Danger](id:starforged/moves/adventure/face_danger) to soothe a being’s distress by creating an empathic bond, roll +spirit and take +1 momentum on a hit. If they are an ally, also give them +2 spirit on a hit.",
      enhance_moves: [
        {
          roll_type: "action_roll",
          enhances: ["starforged/moves/*/face_danger"],
          trigger: {
            conditions: [
              {
                method: "player_choice",
                roll_options: [
                  {
                    using: "condition_meter",
                    condition_meter: "spirit",
                  },
                ],
                text: "To soothe a being's distress by creating an empathic bond",
              },
            ],
          },
        },
      ],
    },
  ],
  source: {
    title: "Ironsworn: Starforged Assets",
    authors: [
      {
        name: "Shawn Tomkin",
      },
    ],
    date: "2022-05-06",
    url: "https://ironswornrpg.com",
    license: "https://creativecommons.org/licenses/by/4.0",
  },
};

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
        "starforged/assets/path/empath": TestAsset,
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
          {
            assets: [
              { id: "starforged/assets/path/empath" },
            ] as IronswornCharacterAsset[],
          },
          mockIndex,
        ).moves,
      ).toEqual([]);
    });
    it("includes moves for marked asset abilities", () => {
      // This ability has no additional moves.
      expect(
        new IronswornCharacterMetadata(
          {
            assets: [
              { id: "starforged/assets/path/empath", marked_abilities: [2] },
            ] as IronswornCharacterAsset[],
          },
          mockIndex,
        ).moves,
      ).toHaveLength(0);

      // This ability adds one extra move.
      expect(
        new IronswornCharacterMetadata(
          {
            assets: [
              { id: "starforged/assets/path/empath", marked_abilities: [1, 2] },
            ] as IronswornCharacterAsset[],
          },
          mockIndex,
        ).moves,
      ).toMatchObject([
        { id: "starforged/assets/path/empath/abilities/0/moves/read_heart" },
      ]);
    });
  });
});
