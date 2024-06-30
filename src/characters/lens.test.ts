import { type Datasworn } from "@datasworn/core";
import starforgedData from "@datasworn/starforged/json/starforged.json" with { type: "json" };
import { VersionedMapImpl } from "utils/versioned-map";
import { Ruleset } from "../rules/ruleset";
import { ChallengeRanks } from "../tracks/progress";
import { Right } from "../utils/either";
import { Lens, updating } from "../utils/lens";
import { IDataContext } from "./action-context";
import {
  BaseIronVaultSchema,
  IronVaultSheetAssetInput,
  characterLens,
  createValidCharacter,
  momentumOps,
  movesReader,
  validatedAgainst,
} from "./lens";

const STARFORGED_RULESET = new Ruleset(
  ["starforged"],
  starforgedData.rules as Datasworn.Rules,
);
const TEST_RULESET = new Ruleset(["test"], {
  condition_meters: {
    health: {
      label: "health",
      description: "aka hp",
      min: 0,
      max: 5,
      rollable: true,
      shared: false,
      value: 3,
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
  const { validater, lens } = characterLens(TEST_RULESET);

  it("returns a validated character on valid input", () => {
    expect(
      validatedAgainst(TEST_RULESET, validater(VALID_INPUT).unwrap()),
    ).toBeTruthy();
  });

  it("sets a default for missing stat properties", () => {
    const data = { ...VALID_INPUT, wits: undefined };
    expect(lens.stats.wits.get(validater(data).unwrap())).toBe(0);
  });

  it("requires condition meter properties", () => {
    const data = { ...VALID_INPUT, health: undefined };
    expect(lens.condition_meters.health.get(validater(data).unwrap())).toBe(3);
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
    }).unwrap();

    actsLikeLens(lens.name, character, "Foo");
  });

  describe("stat", () => {
    const character = validater({ ...VALID_INPUT, wits: 3 }).unwrap();
    actsLikeLens(lens.stats.wits, character, 4);

    it("enforces a minimum", () => {
      expect(() => lens.stats.wits.update(character, -1)).toThrow(/too_small/);
    });

    it("enforces a maximum", () => {
      expect(() => lens.stats.wits.update(character, 6)).toThrow(/too_big/);
    });
  });

  describe("stat", () => {
    const character = validater({ ...VALID_INPUT, health: 3 }).unwrap();
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
        {
          id: "asset_id",
          abilities: [true, false, false],
          controls: { integrity: 2 },
        },
      ] as IronVaultSheetAssetInput[],
    }).unwrap();
    actsLikeLens(lens.assets, character, [
      {
        id: "new_asset",
        abilities: [true, false, false],
        controls: { integrity: 3 },
        options: {},
      },
    ]);

    it("requires a valid asset definition", () => {
      expect(() =>
        lens.assets.update(character, [{ foo: "bar" }] as never),
      ).toThrow(/invalid_type/);
    });

    it("get returns an empty array if missing in source", () => {
      expect(
        lens.assets.get(validater({ ...VALID_INPUT }).unwrap()),
      ).toStrictEqual([]);
    });
  });

  describe("#impacts", () => {
    const character = validater({
      ...VALID_INPUT,
      wounded: "a",
    }).unwrap();

    actsLikeLens(lens.impacts, character, {
      wounded: true,
      disappointed: false,
    });

    it("treats a missing key as unmarked", () => {
      const character = validater({ ...VALID_INPUT }).unwrap();
      expect(lens.impacts.get(character)).toEqual({
        wounded: false,
        disappointed: false,
      });
    });

    it("rejects an invalid impact type", () => {
      expect(() => lens.impacts.update(character, { foobar: true })).toThrow(
        "unexpected key in impacts: foobar",
      );
    });
  });
});

describe("momentumOps", () => {
  const { validater, lens } = characterLens(TEST_RULESET);
  const { reset, take, suffer } = momentumOps(lens);

  describe("with no impacts marked", () => {
    describe("take", () => {
      it("adds momentum", () => {
        const character = validater({ ...VALID_INPUT, momentum: 3 }).unwrap();
        expect(lens.momentum.get(take(3)(character))).toBe(6);
      });

      it("enforces a maximum", () => {
        const character = validater({ ...VALID_INPUT, momentum: 3 }).unwrap();
        expect(lens.momentum.get(take(8)(character))).toBe(10);
      });
    });

    describe("suffer", () => {
      it("removes momentum", () => {
        const character = validater({ ...VALID_INPUT, momentum: 3 }).unwrap();
        expect(lens.momentum.get(suffer(3)(character))).toBe(0);
      });
      it("enforces a minimum of -6", () => {
        const character = validater({ ...VALID_INPUT, momentum: 3 }).unwrap();
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
      ...Object.fromEntries(impactKeys.map((key) => [key, true])),
    }).unwrap();
    it(`caps momentum to ${max}`, () => {
      expect(lens.momentum.get(take(8)(character))).toBe(max);
    });

    it(`resets momentum to ${momentumReset}`, () => {
      expect(lens.momentum.get(reset(character))).toBe(momentumReset);
    });
  });
});

// TODO: generate an actual test asset
const TestAsset: Datasworn.Asset = starforgedData.assets.path.contents
  .empath as unknown as Datasworn.Asset;

describe("movesReader", () => {
  let mockDataContext: IDataContext;

  beforeAll(() => {
    mockDataContext = {
      assets: new VersionedMapImpl<string, Datasworn.Asset>().set(
        TestAsset._id,
        TestAsset,
      ),
      moves: new VersionedMapImpl(),
    };
  });

  describe("moves", () => {
    const { validater, lens } = characterLens(TEST_RULESET);

    it("is empty if no assets", () => {
      expect(
        movesReader(lens, mockDataContext).get(
          validater({ ...VALID_INPUT }).unwrap(),
        ),
      ).toEqual(Right.create([]));
    });

    it("does not include moves for unmarked asset abilities", () => {
      expect(
        movesReader(lens, mockDataContext).get(
          validater({
            ...VALID_INPUT,
            assets: [
              {
                id: "asset:starforged/path/empath",
                abilities: [false, false, false],
              },
            ],
          } satisfies BaseIronVaultSchema).unwrap(),
        ),
      ).toEqual(Right.create([]));
    });

    it("includes moves for marked asset abilities", () => {
      // This ability has no additional moves.
      expect(
        movesReader(lens, mockDataContext)
          .get(
            validater({
              ...VALID_INPUT,
              assets: [
                {
                  id: "asset:starforged/path/empath",
                  abilities: [false, true, false],
                },
              ],
            } satisfies BaseIronVaultSchema).unwrap(),
          )
          .unwrap(),
      ).toHaveLength(0);

      // This ability adds one extra move.
      expect(
        movesReader(lens, mockDataContext)
          .get(
            validater({
              ...VALID_INPUT,
              assets: [
                {
                  id: "asset:starforged/path/empath",
                  abilities: [true, true, false],
                },
              ],
            } satisfies BaseIronVaultSchema).unwrap(),
          )
          .unwrap(),
      ).toMatchObject([
        {
          move: {
            _id: "asset.ability.move:starforged/path/empath.0.read_heart",
          },
          asset: { _id: "asset:starforged/path/empath" },
        },
      ]);
    });
  });
});

describe("Special Tracks", () => {
  const { validater, lens } = characterLens({
    ...TEST_RULESET,
    id: TEST_RULESET.id,
    special_tracks: {
      quests_legacy: {
        label: "quests",
        optional: false,
        shared: false,
        description: "Swear vows and do what you must to see them fulfilled.",
      },
    },
  });

  it("defaults Progress field to 0", () => {
    expect(
      lens.special_tracks["quests_legacy"].get(
        validater({ ...VALID_INPUT, Quests_XPEarned: 0 }).unwrap(),
      ).progress,
    ).toBe(0);
  });

  it("extracts a progress track", () => {
    const character = validater({
      ...VALID_INPUT,
      Quests_Progress: 4,
      Quests_XPEarned: 2,
    }).unwrap();
    const track = lens.special_tracks["quests_legacy"].get(character);
    expect(track).toMatchObject({
      progress: 4,
      unbounded: true,
      complete: false,
      rank: ChallengeRanks.Epic,
    });
  });

  it("updates a progress track", () => {
    const character = validater({
      ...VALID_INPUT,
      Quests_Progress: 4,
      Quests_XPEarned: 2,
    }).unwrap();
    expect(
      updating(lens.special_tracks["quests_legacy"], (track) =>
        track.advanced(2),
      )(character).raw,
    ).toMatchObject({
      Quests_Progress: 6,
      Quests_XPEarned: 2,
    });
  });

  it("advances xp earned", () => {
    const character = validater({
      ...VALID_INPUT,
      Quests_Progress: 4,
      Quests_XPEarned: 2,
    }).unwrap();
    expect(
      updating(lens.special_tracks["quests_legacy"], (track) =>
        track.advanced(4),
      )(character).raw,
    ).toMatchObject({
      Quests_Progress: 8,
      Quests_XPEarned: 4,
    });
  });
});

describe("createValidCharacter", () => {
  const { lens, validater } = characterLens(STARFORGED_RULESET);
  it("creates a fully initialized character", () => {
    expect(createValidCharacter(lens, validater, "Bobby").raw).toEqual({
      name: "Bobby",
      momentum: 2,
      health: 5,
      spirit: 5,
      supply: 5,
      iron: 0,
      wits: 0,
      shadow: 0,
      heart: 0,
      edge: 0,
      xp_spent: 0,
      Bonds_Progress: 0,
      Bonds_XPEarned: 0,
      Discoveries_Progress: 0,
      Discoveries_XPEarned: 0,
      Quests_Progress: 0,
      Quests_XPEarned: 0,
    });
  });
});
