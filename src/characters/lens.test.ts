import { Ruleset } from "../rules/ruleset";
import {
  ForgedSheetAssetSchema,
  ImpactStatus,
  Lens,
  characterLens,
  momentumOps,
  prop,
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

describe("prop", () => {
  it("gets a key from an object", () => {
    const lens = prop<number>("foo");
    expect(lens.get({ foo: 3 })).toBe(3);
  });

  it("updates a key if new value", () => {
    const lens = prop<number>("foo");
    expect(lens.update({ foo: 3 }, 4)).toEqual({ foo: 4 });
  });

  it("returns the original object if update passed the original value", () => {
    const lens = prop<number>("foo");
    const obj = { foo: 3 };
    expect(lens.update(obj, 3)).toBe(obj);
  });
});

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
