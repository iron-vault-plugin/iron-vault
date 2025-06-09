import { describe, expect, it } from "vitest";
import { convertToStandardDice, Dice } from "./dice";
import { DiceGroup } from "./dice-group";
import {
  asyncifyRoller,
  DiceResult,
  DiceRoller,
  StandardizingDiceRoller,
} from "./dice-roller";

class MockDiceRoller implements DiceRoller {
  #expectedRolls: [DiceGroup, DiceResult[]][] = [];

  constructor() {}

  addExpectedRoll(group: DiceGroup, results: DiceResult[]) {
    this.#expectedRolls.push([group, results]);
  }

  roll(group: DiceGroup): DiceResult[] {
    const [expected, ...rest] = this.#expectedRolls;
    expect(group).toEqual(expected[0]);
    this.#expectedRolls = rest;
    return expected[1];
  }

  get syncSupportsNonStandardDice(): boolean {
    return false;
  }

  get asyncSupportsNonStandardDice(): boolean {
    return false;
  }
}

describe("StandardizingDiceRoller", () => {
  it("should roll dice and standardize results", async () => {
    const mock = new MockDiceRoller();
    const roller = new StandardizingDiceRoller(asyncifyRoller(mock));

    const group = DiceGroup.of(Dice.fromDiceString("2d9"));
    const d6 = Dice.fromDiceString("1d6");

    mock.addExpectedRoll(DiceGroup.of(d6, d6, d6, d6), [
      { dice: d6, value: 1, rolls: [1] },
      { dice: d6, value: 6, rolls: [6] },
      { dice: d6, value: 2, rolls: [2] },
      { dice: d6, value: 3, rolls: [3] },
    ]);

    const expr = convertToStandardDice(9);
    const expectedRolls = [1, 6, 2, 3];
    const expected1 = expr.evaluate(() => expectedRolls.shift()!);
    const expected2 = expr.evaluate(() => expectedRolls.shift()!);

    const results = roller.roll(group);
    expect(results).toEqual([
      {
        dice: Dice.fromDiceString("2d9"),
        value: expected1 + expected2,
        rolls: [expected1, expected2],
        exprs: expect.arrayContaining([
          expect.objectContaining({
            label: expect.objectContaining({
              value: expected1,
            }),
          }),
          expect.objectContaining({
            label: expect.objectContaining({
              value: expected2,
            }),
          }),
        ]),
      },
    ]);
  });
});
