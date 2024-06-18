import { Dice } from "./dice";

it("parses and rolls", async () => {
  const dice = Dice.fromDiceString("3d4");
  expect(dice.count).toBe(3);
  expect(dice.sides).toBe(4);
  expect(await dice.roll()).toBeGreaterThanOrEqual(3);
  expect(dice.maxRoll()).toBe(12);
});

it("flips values", () => {
  const dice = Dice.fromDiceString("3d4");
  expect(dice.flip(12)).toBe(1);
  expect(dice.flip(1)).toBe(12);
  expect(dice.flip(6)).toBe(7);
});
