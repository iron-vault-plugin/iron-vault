import { Dice } from "./dice";

it("parses and rolls", () => {
  const dice = Dice.fromDiceString("3d4");
  expect(dice.count).toBe(3);
  expect(dice.sides).toBe(4);
  expect(dice.roll()).toBeGreaterThanOrEqual(3);
});
