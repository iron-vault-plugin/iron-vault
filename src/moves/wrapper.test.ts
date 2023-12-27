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
        adds: 0,
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
        adds: 0,
        challenge1,
        challenge2,
        burn: { orig: momentum, reset: 2 },
      });
      expect(roll.originalResult()).toBe(originalResult);
      expect(roll.result()).toBe(newResult);
    },
  );
});
