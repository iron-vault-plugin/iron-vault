import { numberRange } from "@ironvault/utils/numbers";
import { describe, expect, it } from "vitest";
import {
  BinaryOpNode,
  Dice,
  DiceExprNode,
  ExprId,
  NumberNode,
  UnaryOpNode,
  calcRange,
  convertToStandardDice,
  evaluateExpr,
  expandNonStandardDice,
  numberDiceExpressions,
  parseDiceExpression,
  rollsFromMap,
} from "./dice";

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

describe("numberDiceExpressions", () => {
  it("adds unique symbols to dice expressions", () => {
    const expr = parseDiceExpression("2d6");
    const labeled = numberDiceExpressions(ExprId, expr);
    expect(labeled.label[ExprId]).toBe(1);
  });

  it("increments counter for multiple dice expressions", () => {
    const expr = parseDiceExpression("2d6 + 3d8");
    const labeled = numberDiceExpressions(ExprId, expr);

    const symbols: (number | undefined)[] = [];
    labeled.walk({
      visitDiceExprNode: (node) => {
        symbols.push(node.label[ExprId]);
      },
    });

    expect(symbols).toEqual([1, 2]);
  });

  it("doesn't modify number nodes", () => {
    const expr = parseDiceExpression("42");
    const labeled = numberDiceExpressions(ExprId, expr);
    expect(labeled.label[ExprId]).toBeUndefined();
  });

  it("preserves original labels while adding symbols", () => {
    const originalExpr = new DiceExprNode(new Dice(2, 6), {
      originalProp: "test",
    });
    const labeled = numberDiceExpressions(ExprId, originalExpr);

    expect(labeled.label.originalProp).toBe("test");
    expect(labeled.label[ExprId]).toBeDefined();
  });

  it("handles complex expressions with multiple dice", () => {
    const expr = parseDiceExpression("1d20 + (2d6 * 3) - 4d4");
    const labeled = numberDiceExpressions(ExprId, expr);

    const symbols: (number | undefined)[] = [];
    labeled.walk({
      visitDiceExprNode: (node) => {
        symbols.push(node.label[ExprId]);
      },
    });

    expect(symbols).toEqual([1, 2, 3]);
  });
});

describe("evaluateExpr", () => {
  it("evaluates number nodes", () => {
    const expr = parseDiceExpression("42");
    const result = evaluateExpr(expr, () => {
      throw new Error("Test error");
    });
    expect(result.label.value).toBe(42);
  });

  it("evaluates dice expressions", () => {
    const expr = parseDiceExpression("2d6");
    const resultMap = new Map([[expr, [3, 4]]]);
    const result = evaluateExpr(expr, rollsFromMap(resultMap));
    expect(result.label.value).toBe(7);
    expect(result.label.rolls).toEqual([3, 4]);
  });

  it("evaluates binary operations", () => {
    const expr = parseDiceExpression("2d6 + 5");
    const result = evaluateExpr(expr, () => [3, 4]);
    expect(result.label.value).toBe(12);
  });

  it("evaluates unary operations", () => {
    const expr = parseDiceExpression("-2d6");
    const result = evaluateExpr(expr, () => [3, 4]);
    expect(result.label.value).toBe(-7);
  });

  it("handles complex expressions with nested operations", () => {
    const expr = parseDiceExpression("2d6 * (1d4 - 2)");
    const rollsMap = new Map([
      ["2d6", [3, 4]],
      ["1d4", [3]],
    ]);
    const result = evaluateExpr(expr, (node) => {
      return rollsMap.get(node.toString());
    });
    expect(result.label.value).toBe(7); // (3+4) * (3-2) = 7 * 1 = 7
  });

  it("preserves original labels", () => {
    const origNode = new DiceExprNode(new Dice(2, 6), { originalData: "test" });
    const result = evaluateExpr(origNode, () => [3, 4]);
    expect(result.label.originalData).toBe("test");
    expect(result.label.value).toBe(7);
  });

  it("evaluates expressions with multiple dice", () => {
    const expr = parseDiceExpression("1d20 + 2d6");
    const rollsMap = new Map([
      ["1d20", [15]],
      ["2d6", [3, 4]],
    ]);
    const result = evaluateExpr(expr, (node) => {
      return rollsMap.get(node.toString()) || [];
    });
    expect(result.label.value).toBe(22); // 15 + (3+4) = 22
  });

  it("evaluates expressions with all types of operations", () => {
    const expr = parseDiceExpression("2d6 + 3 * (1d4 - 2) / 2");
    const rollsMap = new Map([
      ["2d6", [3, 4]],
      ["1d4", [3]],
    ]);
    const result = evaluateExpr(expr, (node) => {
      return rollsMap.get(node.toString()) || [];
    });
    expect(result.label.value).toBe(8); // (3+4) + 3 * (3-2) / 2 = 7 + 3 * 1 / 2 = 7 + 1 = 8
  });

  it("evaluates modulo operations", () => {
    const expr = parseDiceExpression("1d6 % 4");
    const result = evaluateExpr(expr, () => [6]);
    expect(result.label.value).toBe(2); // 6 % 4 = 2
  });

  it("can track multiple sets of dice rolls", () => {
    const expr = parseDiceExpression("1d20 + 2d6 - 1d4");
    const rollsFor = (node: DiceExprNode<object>) => {
      if (node.toString() === "1d20") return [20];
      if (node.toString() === "2d6") return [5, 6];
      if (node.toString() === "1d4") return [2];
      return [];
    };

    const result = evaluateExpr(expr, rollsFor);

    let d20Value, d6Value, d4Value;
    result.walk({
      visitDiceExprNode: (node) => {
        if (node.toString() === "1d20") d20Value = node.label.value;
        if (node.toString() === "2d6") d6Value = node.label.value;
        if (node.toString() === "1d4") d4Value = node.label.value;
      },
    });

    expect(d20Value).toBe(20);
    expect(d6Value).toBe(11);
    expect(d4Value).toBe(2);
    expect(result.label.value).toBe(29); // 20 + 11 - 2 = 29
  });

  it("throws an error when no rolls are provided for a specific dice expression in complex expressions", () => {
    const expr = parseDiceExpression("2d6 + 3d4");
    const rollsFor = (node: DiceExprNode<object>) => {
      if (node.toString() === "2d6") return [5, 6];
      return undefined;
    };

    expect(() => evaluateExpr(expr, rollsFor)).toThrow(
      "No rolls found for expression 3d4 in the provided map",
    );
  });

  it("throws an error if too few rolls are provided for a dice expression", () => {
    const expr = parseDiceExpression("3d6");
    // Only provide 2 rolls for 3d6, which requires 3 rolls
    const rollsFor = (node: DiceExprNode<object>) => {
      if (node.toString() === "3d6") return [4, 5];
      return undefined;
    };
    expect(() => evaluateExpr(expr, rollsFor)).toThrow(
      "Expected 3 rolls for expression 3d6, but got 2.",
    );
  });

  it("throws an error if too many rolls are provided for a dice expression", () => {
    const expr = parseDiceExpression("3d6");
    // Provide 4 rolls for 3d6, which requires 3 rolls
    const rollsFor = (node: DiceExprNode<object>) => {
      if (node.toString() === "3d6") return [4, 5, 6, 2];
      return undefined;
    };
    expect(() => evaluateExpr(expr, rollsFor)).toThrow(
      "Expected 3 rolls for expression 3d6, but got 4.",
    );
  });

  it("throws an error if roll value is out of bounds", () => {
    const expr = parseDiceExpression("1d6");
    // Provide a roll value of 7 for 1d6, which is out of bounds
    const rollsFor = (node: DiceExprNode<object>) => {
      if (node.toString() === "1d6") return [7];
      return undefined;
    };
    expect(() => evaluateExpr(expr, rollsFor)).toThrow(
      "Invalid rolls found for expression 1d6: 7",
    );
  });
});
