import { Ruleset } from "../rules/ruleset";
import { Lens, characterLens, prop, validatedAgainst } from "./lens";

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
  impacts: {},
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
  it("returns the same object if value is unchanged", () => {
    expect(lens.update(input, lens.get(input))).toBe(input);
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
});
