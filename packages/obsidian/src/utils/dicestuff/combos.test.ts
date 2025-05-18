import { Dice } from "utils/dice";
import { describe, expect, it } from "vitest";
import { flattenDiceCombination, flattenRangeExpr } from "./combos";

describe("flattenDiceCombination", () => {
  it("returns the same dice if only one exists", () => {
    const dice = new Dice(2, 6); // 2d6
    expect(flattenDiceCombination([dice])).toEqual(dice);
  });

  it("flattens a combination of two dice", () => {
    const dice1 = new Dice(1, 6); // 1d6
    const dice2 = new Dice(1, 6); // 1d6
    const result = flattenDiceCombination([dice1, dice2]);
    expect(result).toEqual(new Dice(1, 36)); // 1d36
  });

  it("flattens a combination of three dice", () => {
    const dice1 = new Dice(1, 4); // 1d4
    const dice2 = new Dice(1, 6); // 1d6
    const dice3 = new Dice(1, 8); // 1d8
    const result = flattenDiceCombination([dice1, dice2, dice3]);
    expect(result).toEqual(new Dice(1, 192)); // 1d192 (4*6*8)
  });

  it("throws an error when trying to flatten dice with multiple count", () => {
    const dice1 = new Dice(2, 6); // 2d6
    const dice2 = new Dice(1, 8); // 1d8
    expect(() => flattenDiceCombination([dice1, dice2])).toThrow(
      "cannot flatten dice with multiple counts",
    );
  });
});

describe("flattenRangeExpr", () => {
  it("flattens a single dice range", () => {
    const dice = [new Dice(1, 6)];
    const result = flattenRangeExpr(dice, "1-3");
    expect(result).toEqual([{ min: 1, max: 3 }]);
  });

  it("flattens two dice ranges", () => {
    const dice = [new Dice(1, 6), new Dice(1, 6)];
    const result = flattenRangeExpr(dice, "1-2;3-4");
    expect(result).toEqual([
      { min: 3, max: 4 }, // 0*6 + 3 = 3, 0*6 + 4 = 4
      { min: 9, max: 10 }, // 1*6 + 3 = 9, 1*6 + 4 = 10
    ]);
  });

  it("has right min and max", () => {
    const dice = [new Dice(1, 6), new Dice(1, 8)];
    expect(flattenRangeExpr(dice, "1;1-8")).toEqual([{ min: 1, max: 8 }]);
    expect(flattenRangeExpr(dice, "6;1-8")).toEqual([{ min: 41, max: 48 }]);
  });

  it("flattens three dice ranges", () => {
    const dice = [new Dice(1, 4), new Dice(1, 6), new Dice(1, 8)];
    const result = flattenRangeExpr(dice, "2;1-2;3-4");
    expect(result).toEqual([
      { min: 51, max: 52 }, // 1*48 + 0*8 + 3 = 51, 1*48 + 0*8 + 4 = 52
      { min: 59, max: 60 }, // 1*48 + 1*8 + 3 = 59, 1*48 + 1*8 + 4 = 60
    ]);
  });

  it("throws an error with mismatched ranges and dice count", () => {
    const dice = [new Dice(1, 6), new Dice(1, 6)];
    expect(() => flattenRangeExpr(dice, "1-3")).toThrow(
      "expected 2 ranges, found 1",
    );
  });

  it("throws an error with invalid range expression", () => {
    const dice = [new Dice(1, 6)];
    expect(() => flattenRangeExpr(dice, "invalid")).toThrow(
      "invalid range expression invalid",
    );
  });

  it("handles single value ranges correctly", () => {
    const dice = [new Dice(1, 6), new Dice(1, 6)];
    const result = flattenRangeExpr(dice, "1;2");
    expect(result).toEqual([{ min: 2, max: 2 }]); // 0*6 + 2 = 2
  });
});
