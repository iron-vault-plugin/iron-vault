import { ActionMoveWrapper, RollResult } from "./wrapper";

describe("ActionMoveWrapper", () => {
  it.each([
    [2, 3, 4, RollResult.Miss],
    [5, 4, 6, RollResult.WeakHit],
    [8, 2, 3, RollResult.StrongHit],
  ])(
    "determines result for %d vs %d and %d",
    (action, challenge1, challenge2, result) => {
      const roll = new ActionMoveWrapper({
        name: "test",
        action,
        stat: "wits",
        statVal: 0,
        adds: [],
        challenge1,
        challenge2,
      });
      expect(roll.result()).toBe(result);
    },
  );

  it.each([
    [2, 3, 4, 4, RollResult.Miss, RollResult.WeakHit],
    [5, 4, 6, 7, RollResult.WeakHit, RollResult.StrongHit],
  ])(
    "adjusts result of %d vs %d and %d for momentum %d",
    (action, challenge1, challenge2, momentum, originalResult, newResult) => {
      const roll = new ActionMoveWrapper({
        name: "test",
        action,
        stat: "wits",
        statVal: 1,
        adds: [],
        challenge1,
        challenge2,
        burn: { orig: momentum, reset: 2 },
      });
      expect(roll.originalResult()).toBe(originalResult);
      expect(roll.result()).toBe(newResult);
    },
  );

  it("correctly accounts for adds in total", () => {
    expect(
      new ActionMoveWrapper({
        name: "test",
        action: 1,
        stat: "wits",
        statVal: 1,
        adds: [],
        challenge1: 1,
        challenge2: 2,
      }).actionScore,
    ).toBe(2);

    expect(
      new ActionMoveWrapper({
        name: "test",
        action: 1,
        stat: "wits",
        statVal: 1,
        adds: [{ amount: 1 }, { amount: 2 }],
        challenge1: 1,
        challenge2: 2,
      }).actionScore,
    ).toBe(5);
  });
});
