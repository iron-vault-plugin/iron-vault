import {
  BinaryOpNode,
  Dice,
  DiceExprNode,
  NumberNode,
  UnaryOpNode,
  calcRange,
  convertToStandardDice,
  expandNonStandardDice,
  parseDiceExpression,
} from "./dice";
import { numberRange } from "./numbers";

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
describe("DiceExpressionParser", () => {
  it("parses simple numbers", () => {
    const expr = parseDiceExpression("42");
    expect(expr).toBeInstanceOf(NumberNode);
    expect(expr.evaluate(() => 3)).toBe(42);
    expect(expr.toString()).toBe("42");
  });

  it("parses dice expressions", () => {
    const expr = parseDiceExpression("2d6");
    expect(expr).toBeInstanceOf(DiceExprNode);
    expect(expr.evaluate(() => 3)).toBe(3);
    expect(expr.toString()).toBe("2d6");
  });

  it("parses addition expressions", () => {
    const expr = parseDiceExpression("5+3");
    expect(expr).toBeInstanceOf(BinaryOpNode);
    expect(expr.evaluate(() => 3)).toBe(8);
    expect(expr.toString()).toBe("5 + 3");
  });

  it("parses subtraction expressions", () => {
    const expr = parseDiceExpression("10-4");
    expect(expr).toBeInstanceOf(BinaryOpNode);
    expect(expr.evaluate(() => 3)).toBe(6);
    expect(expr.toString()).toBe("10 - 4");
  });

  it("parses multiplication expressions", () => {
    const expr = parseDiceExpression("3*7");
    expect(expr).toBeInstanceOf(BinaryOpNode);
    expect(expr.evaluate(() => 3)).toBe(21);
    expect(expr.toString()).toBe("3 * 7");
  });

  it("parses division expressions", () => {
    const expr = parseDiceExpression("20/3");
    expect(expr).toBeInstanceOf(BinaryOpNode);
    expect(expr.evaluate(() => 3)).toBe(6); // Integer division floors the result
    expect(expr.toString()).toBe("20 / 3");
  });

  it("parses mod expressions", () => {
    const expr = parseDiceExpression("20 % 3");
    expect(expr).toBeInstanceOf(BinaryOpNode);
    expect(expr.evaluate(() => 3)).toBe(2);
    expect(expr.toString()).toBe("20 % 3");
  });

  it("handles operator precedence correctly", () => {
    const expr = parseDiceExpression("2+3*4");
    expect(expr).toBeInstanceOf(BinaryOpNode);
    expect(expr.evaluate(() => 3)).toBe(14);
    expect(expr.toString()).toBe("2 + 3 * 4");
  });

  it("parses parenthesized expressions", () => {
    const expr = parseDiceExpression("(2+3)*4");
    expect(expr).toBeInstanceOf(BinaryOpNode);
    expect(expr.evaluate(() => 3)).toBe(20);
    expect(expr.toString()).toBe("(2 + 3) * 4");
  });

  it("parses unary minus", () => {
    const expr = parseDiceExpression("-5");
    expect(expr).toBeInstanceOf(UnaryOpNode);
    expect(expr.evaluate(() => 3)).toBe(-5);
    expect(expr.toString()).toBe("-5");
  });

  it("parses complex expressions", () => {
    const expr = parseDiceExpression("2d6 + 4 * (1d4 - 2)");
    expect(expr.evaluate(() => 3)).toBe(7);
  });

  it("handles whitespace correctly", () => {
    const expr = parseDiceExpression(" 5 + 3  * 2 ");
    expect(expr.evaluate(() => 3)).toBe(11);
  });

  it("throws error for invalid expressions", () => {
    expect(() => parseDiceExpression("5 + ")).toThrow();
    expect(() => parseDiceExpression("5 + * 3")).toThrow();
    expect(() => parseDiceExpression("(5 + 3")).toThrow();
  });

  it("resolves 6*(1d6-1)+1d6", () => {
    const expr = parseDiceExpression("6*(1d6-1)+1d6");
    expect(expr.evaluate(() => 1)).toBe(1);
    expect(expr.evaluate(() => 6)).toBe(36);
  });

  it("resolves (100*(1d10 % 10)+1d100%100-1)%1000+1", () => {
    const expr = parseDiceExpression("(100*(1d10 % 10)+1d100%100-1)%1000+1");
    expect(expr.evaluate(() => 3)).toBe(303);
    expect(expr.evaluate((dice) => (dice.sides == 10 ? 10 : 100))).toBe(1000);
    expect(expr.toString()).toBe(
      "(100 * (1d10 % 10) + 1d100 % 100 - 1) % 1000 + 1",
    );
  });
});

describe("calcRange", () => {
  it("calculates range for simple numbers", () => {
    const expr = parseDiceExpression("42");
    expect(calcRange(expr)).toEqual([42, 42]);
  });

  it("calculates range for dice expressions", () => {
    const expr = parseDiceExpression("2d6");
    expect(calcRange(expr)).toEqual([2, 12]);
  });

  it("calculates range for addition expressions", () => {
    const expr = parseDiceExpression("1d6 + 3");
    expect(calcRange(expr)).toEqual([4, 9]);
  });

  it("calculates range for subtraction expressions", () => {
    const expr = parseDiceExpression("10 - 1d4");
    expect(calcRange(expr)).toEqual([6, 9]);
  });

  it("calculates range for multiplication expressions", () => {
    const expr = parseDiceExpression("2 * 1d6");
    expect(calcRange(expr)).toEqual([2, 12]);
  });

  it("calculates range for division expressions", () => {
    const expr = parseDiceExpression("12 / 1d4");
    expect(calcRange(expr)).toEqual([3, 12]);
  });

  it("calculates range for modulo expressions", () => {
    const expr = parseDiceExpression("7 % 1d6");
    expect(calcRange(expr)).toEqual([0, 3]);
  });

  it("calculates range for unary minus expressions", () => {
    const expr = parseDiceExpression("-1d6");
    expect(calcRange(expr)).toEqual([-6, -1]);
  });

  it("calculates range for complex expressions", () => {
    const expr = parseDiceExpression("2d6 + 4 * (1d4 - 2)");
    expect(calcRange(expr)).toEqual([-2, 20]);
  });

  it("calculates range for nested dice expressions", () => {
    const expr = parseDiceExpression("1d20 + 1d12");
    expect(calcRange(expr)).toEqual([2, 32]);
  });

  it("calculates range for complex standard dice expressions", () => {
    const expr = parseDiceExpression("6*(1d6-1)+1d6");
    expect(calcRange(expr)).toEqual([1, 36]);
  });

  it("calculates 1d6 / 3 + 1", () => {
    const expr = parseDiceExpression("1d6 / 3 + 1");
    expect(calcRange(expr)).toEqual([1, 3]);
  });
});

describe("convertToStandardDice", () => {
  it("returns a dice expression for standard dice", () => {
    const result = convertToStandardDice(6);
    expect(result).toBeInstanceOf(DiceExprNode);
    expect(result.toString()).toBe("1d6");
  });

  it("handles non-standard dice", () => {
    const result = convertToStandardDice(36);
    expect(result).toBeInstanceOf(BinaryOpNode);
    expect(result.toString()).toBe("1d6 + 6 * (1d6 - 1)");
  });

  it("throws an error for invalid sides (zero or negative)", () => {
    expect(() => convertToStandardDice(0)).toThrow("Invalid number of sides");
    expect(() => convertToStandardDice(-5)).toThrow("Invalid number of sides");
  });

  it("throws an error for non-integer sides", () => {
    expect(() => convertToStandardDice(5.5)).toThrow("Invalid number of sides");
  });

  it("handles large numbers of sides", () => {
    const result = convertToStandardDice(120);
    expect(result.toString()).toBe("1d10 + 10 * (1d12 - 1)");
  });

  it("correctly handles powers of standard dice (e.g. 100)", () => {
    const result = convertToStandardDice(100);
    expect(result).toBeInstanceOf(DiceExprNode);
    expect(result.toString()).toBe("1d100");
  });

  it("correctly handles products of standard dice (e.g. 60 = 6*10)", () => {
    const result = convertToStandardDice(60);
    expect(result.toString()).toBe("1d10 + 10 * (1d6 - 1)");
  });

  it("correctly handles products of standard dice (e.g. 60 = 6*10)", () => {
    const result = convertToStandardDice(60);
    expect(result.toString()).toBe("1d10 + 10 * (1d6 - 1)");
  });

  it("handles d1000 specially", () => {
    const result = convertToStandardDice(1000);
    //(100*(d10 % 10)+d100%100-1)%1000+1
    expect(result.toString()).toBe(
      "(100 * (1d10 % 10) + 1d100 % 100 - 1) % 1000 + 1",
    );
  });

  it("handles d300", () => {
    const result = convertToStandardDice(300);
    expect(result.toString()).toBe("1d100 + 100 * ((1d6 - 1) / 2 + 1 - 1)");
    expect(calcRange(result)).toEqual([1, 300]);
  });

  it.each(numberRange(1, 100))("handles d%d", (sides) => {
    const result = convertToStandardDice(sides);
    try {
      expect(calcRange(result)).toEqual([1, sides]);
    } catch (e) {
      throw new Error(
        `Not calculating ${result} correctly for d${sides}: ${e}`,
      );
    }
  });
});

describe("expandNonStandardDice", () => {
  it("expands single non-standard dice", () => {
    const expr = parseDiceExpression("1d36");
    const expanded = expandNonStandardDice(expr);
    expect(expanded.toString()).toBe("1d6 + 6 * (1d6 - 1)");
    expect(calcRange(expanded)).toEqual([1, 36]);
  });

  it("expands multiple non-standard dice", () => {
    const expr = parseDiceExpression("2d36");
    const expanded = expandNonStandardDice(expr);
    expect(expanded.toString()).toBe(
      "1d6 + 6 * (1d6 - 1) + 1d6 + 6 * (1d6 - 1)",
    );
    expect(calcRange(expanded)).toEqual([2, 72]);
  });

  it("doesn't change standard dice", () => {
    const expr = parseDiceExpression("3d6");
    const expanded = expandNonStandardDice(expr);
    expect(expanded.toString()).toBe("3d6");
    expect(calcRange(expanded)).toEqual([3, 18]);
  });

  it("expands non-standard dice in complex expressions", () => {
    const expr = parseDiceExpression("1d36 + 2d6");
    const expanded = expandNonStandardDice(expr);
    expect(expanded.toString()).toBe("1d6 + 6 * (1d6 - 1) + 2d6");
    expect(calcRange(expanded)).toEqual([3, 48]);
  });

  it("handles expressions with arithmetic operators", () => {
    const expr = parseDiceExpression("1d36 * 2");
    const expanded = expandNonStandardDice(expr);
    expect(expanded.toString()).toBe("(1d6 + 6 * (1d6 - 1)) * 2");
    expect(calcRange(expanded)).toEqual([2, 72]);
  });

  it("expands nested expressions with non-standard dice", () => {
    const expr = parseDiceExpression("(1d36 - 5) / 2");
    const expanded = expandNonStandardDice(expr);
    expect(expanded.toString()).toBe("(1d6 + 6 * (1d6 - 1) - 5) / 2");
    expect(calcRange(expanded)).toEqual([-2, 15]);
  });

  it("handles unary operators with non-standard dice", () => {
    const expr = parseDiceExpression("-1d36");
    const expanded = expandNonStandardDice(expr);
    expect(expanded.toString()).toBe("-(1d6 + 6 * (1d6 - 1))");
    expect(calcRange(expanded)).toEqual([-36, -1]);
  });

  it("properly expands d1000 dice", () => {
    const expr = parseDiceExpression("1d1000");
    const expanded = expandNonStandardDice(expr);
    expect(expanded.toString()).toBe(
      "(100 * (1d10 % 10) + 1d100 % 100 - 1) % 1000 + 1",
    );
    expect(calcRange(expanded)).toEqual([1, 1000]);
  });

  it("handles multiple occurrences of the same non-standard dice", () => {
    const expr = parseDiceExpression("1d36 + 1d36");
    const expanded = expandNonStandardDice(expr);
    expect(expanded.toString()).toBe(
      "1d6 + 6 * (1d6 - 1) + 1d6 + 6 * (1d6 - 1)",
    );
    expect(calcRange(expanded)).toEqual([2, 72]);
  });
});
