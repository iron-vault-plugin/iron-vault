import { Asset } from "@datasworn/core";
import { DataIndex } from "../datastore/data-index";
import { Ruleset } from "../rules/ruleset";
import { Right } from "../utils/either";
import { Lens } from "../utils/lens";
import {
  BaseForgedSchema,
  ForgedSheetAssetSchema,
  ImpactStatus,
  characterLens,
  momentumOps,
  movesReader,
  validatedAgainst,
} from "./lens";

const TEST_RULESET = new Ruleset("test", {
  condition_meters: {
    health: {
      label: "health",
      description: "aka hp",
      min: 0,
      max: 5,
      rollable: true,
      shared: false,
      value: 0,
    },
  },
  stats: {
    wits: { description: "thinking", label: "wits" },
  },
  impacts: {
    misfortunes: {
      label: "misfortunes",
      description: "Oh no",
      contents: {
        wounded: {
          label: "wounded",
          prevents_recovery: ["health"],
          permanent: false,
          shared: false,
          description: "You are severely injured.",
        },
        disappointed: {
          label: "disappointed",
          description: "You are disappointed",
          permanent: false,
          shared: false,
          prevents_recovery: [],
        },
      },
    },
  },
  special_tracks: {},
  tags: {},
});

const VALID_INPUT = {
  name: "Bob",
  momentum: 5,
  health: 3,
  wits: 2,
};

describe("validater", () => {
  const { validater } = characterLens(TEST_RULESET);

  it("returns a validated character on valid input", () => {
    expect(validatedAgainst(TEST_RULESET, validater(VALID_INPUT))).toBeTruthy();
  });

  it("requires stat properties", () => {
    const data = { ...VALID_INPUT, wits: undefined };
    expect(() => validater(data)).toThrow(/wits/);
  });

  it("requires condition meter properties", () => {
    const data = { ...VALID_INPUT, health: undefined };
    expect(() => validater(data)).toThrow(/health/);
  });
});

function actsLikeLens<T, U>(lens: Lens<T, U>, input: T, testVal: U) {
  it("returns an equivalent object if value is unchanged", () => {
    expect(lens.update(input, lens.get(input))).toStrictEqual(input);
  });

  it("returns the correct value after updating", () => {
    const updated = lens.update(input, testVal);
    expect(lens.get(updated)).toEqual(testVal);
  });
}

describe("characterLens", () => {
  const { validater, lens } = characterLens(TEST_RULESET);

  describe("#name", () => {
    const character = validater({
      ...VALID_INPUT,
      name: "Test Name",
    });

    actsLikeLens(lens.name, character, "Foo");
  });

  describe("stat", () => {
    const character = validater({ ...VALID_INPUT, wits: 3 });
    actsLikeLens(lens.stats.wits, character, 4);

    it("enforces a minimum", () => {
      expect(() => lens.stats.wits.update(character, -1)).toThrow(/too_small/);
    });

    it("enforces a maximum", () => {
      expect(() => lens.stats.wits.update(character, 6)).toThrow(/too_big/);
    });
  });

  describe("stat", () => {
    const character = validater({ ...VALID_INPUT, health: 3 });
    actsLikeLens(lens.condition_meters.health, character, 4);

    it("enforces a minimum", () => {
      expect(() => lens.condition_meters.health.update(character, -1)).toThrow(
        /too_small/,
      );
    });

    it("enforces a maximum", () => {
      expect(() => lens.condition_meters.health.update(character, 6)).toThrow(
        /too_big/,
      );
    });
  });

  describe("#assets", () => {
    const character = validater({
      ...VALID_INPUT,
      assets: [
        { id: "asset_id", condition_meter: 3 },
      ] as ForgedSheetAssetSchema[],
    });
    actsLikeLens(lens.assets, character, [{ id: "new_asset" }]);

    it("requires a valid asset definition", () => {
      expect(() =>
        lens.assets.update(character, [{ foo: "bar" }] as any),
      ).toThrow(/invalid_type/);
    });

    it("get returns an empty array if missing in source", () => {
      expect(lens.assets.get(validater({ ...VALID_INPUT }))).toStrictEqual([]);
    });
  });

  describe("#impacts", () => {
    const character = validater({
      ...VALID_INPUT,
      wounded: "a",
    });

    actsLikeLens(lens.impacts, character, {
      wounded: ImpactStatus.Marked,
      disappointed: ImpactStatus.Unmarked,
    });

    it("treats any string other than ⬢ as unmarked", () => {
      expect(lens.impacts.get(character)).toEqual({
        wounded: ImpactStatus.Unmarked,
        disappointed: ImpactStatus.Unmarked,
      });
    });

    it("treats a missing key as unmarked", () => {
      const character = validater({ ...VALID_INPUT });
      expect(lens.impacts.get(character)).toEqual({
        wounded: ImpactStatus.Unmarked,
        disappointed: ImpactStatus.Unmarked,
      });
    });

    it("treats ⬢ as marked", () => {
      expect(
        lens.impacts.get(
          lens.impacts.update(character, { wounded: ImpactStatus.Marked }),
        ),
      ).toEqual({
        wounded: ImpactStatus.Marked,
        disappointed: ImpactStatus.Unmarked,
      });
    });

    it("rejects an invalid impact type", () => {
      expect(() =>
        lens.impacts.update(character, { foobar: ImpactStatus.Marked }),
      ).toThrow("unexpected key in impacts: foobar");
    });
  });
});

describe("momentumOps", () => {
  const { validater, lens } = characterLens(TEST_RULESET);
  const { reset, take, suffer } = momentumOps(lens);

  describe("with no impacts marked", () => {
    describe("take", () => {
      it("adds momentum", () => {
        const character = validater({ ...VALID_INPUT, momentum: 3 });
        expect(lens.momentum.get(take(3)(character))).toBe(6);
      });

      it("enforces a maximum", () => {
        const character = validater({ ...VALID_INPUT, momentum: 3 });
        expect(lens.momentum.get(take(8)(character))).toBe(10);
      });
    });

    describe("suffer", () => {
      it("removes momentum", () => {
        const character = validater({ ...VALID_INPUT, momentum: 3 });
        expect(lens.momentum.get(suffer(3)(character))).toBe(0);
      });
      it("enforces a minimum of -6", () => {
        const character = validater({ ...VALID_INPUT, momentum: 3 });
        expect(lens.momentum.get(suffer(10)(character))).toBe(-6);
      });
    });
  });

  describe.each([
    [0, 10, 2],
    [1, 10 - 1, 1],
    [2, 10 - 2, 0],
    // [4, 10 - 4], // TODO: add more test impacts?
  ])("when %d impacts marked", (impacts, max, momentumReset) => {
    const impactKeys = Object.keys(TEST_RULESET.impacts).slice(0, impacts);
    const character = validater({
      ...VALID_INPUT,
      momentum: 3,
      ...Object.fromEntries(
        impactKeys.map((key) => [key, ImpactStatus.Marked]),
      ),
    });
    it(`caps momentum to ${max}`, () => {
      expect(lens.momentum.get(take(8)(character))).toBe(max);
    });

    it(`resets momentum to ${momentumReset}`, () => {
      expect(lens.momentum.get(reset(character))).toBe(momentumReset);
    });
  });
});

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

  describe("moves", () => {
    const { validater, lens } = characterLens(TEST_RULESET);

    it("is empty if no assets", () => {
      expect(
        movesReader(lens, mockIndex).get(validater({ ...VALID_INPUT })),
      ).toEqual(Right.create([]));
    });

    it("does not include moves for unmarked asset abilities", () => {
      expect(
        movesReader(lens, mockIndex).get(
          validater({
            ...VALID_INPUT,
            assets: [{ id: "starforged/assets/path/empath" }],
          } satisfies BaseForgedSchema),
        ),
      ).toEqual(Right.create([]));
    });
    it("includes moves for marked asset abilities", () => {
      // This ability has no additional moves.
      expect(
        movesReader(lens, mockIndex)
          .get(
            validater({
              ...VALID_INPUT,
              assets: [
                { id: "starforged/assets/path/empath", marked_abilities: [2] },
              ],
            } satisfies BaseForgedSchema),
          )
          .unwrap(),
      ).toHaveLength(0);

      // This ability adds one extra move.
      expect(
        movesReader(lens, mockIndex)
          .get(
            validater({
              ...VALID_INPUT,
              assets: [
                {
                  id: "starforged/assets/path/empath",
                  marked_abilities: [1, 2],
                },
              ],
            } satisfies BaseForgedSchema),
          )
          .unwrap(),
      ).toMatchObject([
        { id: "starforged/assets/path/empath/abilities/0/moves/read_heart" },
      ]);
    });
  });
});
