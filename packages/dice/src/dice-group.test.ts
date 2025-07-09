import { describe, expect, it } from "vitest";
import {
  calcRange,
  Dice,
  DiceExprNode,
  NumberNode,
  parseDiceExpression,
} from "./dice";
import { DiceExprGroup, DiceGroup } from "./dice-group";

describe("DiceGroup", () => {
  describe("of", () => {
    it("creates a DiceGroup from Dice instances", () => {
      const d6 = Dice.fromDiceString("1d6");
      const d20 = Dice.fromDiceString("1d20");
      const group = DiceGroup.of(d6, d20).asExprGroup();

      expect(group).toBeInstanceOf(DiceExprGroup);
      expect(group.exprs.length).toBe(2);
      expect(group.exprs[0]).toBeInstanceOf(DiceExprNode);
      expect(group.exprs[1]).toBeInstanceOf(DiceExprNode);
    });

    it("creates an empty DiceGroup when no dice provided", () => {
      const group = DiceGroup.of().asExprGroup();

      expect(group).toBeInstanceOf(DiceExprGroup);
      expect(group.exprs.length).toBe(0);
    });
  });

  describe("standardize", () => {
    it("preserves standard dice in the resulting group", () => {
      const d6 = Dice.fromDiceString("1d6");
      const d20 = Dice.fromDiceString("1d20");
      const group = DiceGroup.of(d6, d20);

      const exprGroup = group.standardize();
      const diceList = exprGroup.flattenDice();

      expect(diceList.length).toBe(2);
      expect(diceList[0].toString()).toBe("1d6");
      expect(diceList[1].toString()).toBe("1d20");
    });

    it("converts non-standard dice to standard dice", () => {
      const nonStandard = Dice.fromDiceString("1d9");
      const group = DiceGroup.of(nonStandard);

      const exprGroup = group.standardize();
      expect(exprGroup.exprs.length).toBe(1);
      expect(calcRange(exprGroup.exprs[0])).toEqual([1, 9]);

      const diceList = exprGroup.flattenDice();
      expect(diceList.map((d) => d.toString())).toEqual(["1d6", "1d6"]);
    });

    it("expands dice counts to individual dice expressions", () => {
      const multiDice = Dice.fromDiceString("3d9");
      const group = DiceGroup.of(multiDice);

      const exprGroup = group.standardize();
      expect(exprGroup.exprs.length).toBe(3);

      for (let i = 0; i < 3; i++) {
        expect(
          exprGroup.exprs[i].label[DiceGroup.GroupLabel],
          `expr ${i} labels`,
        ).toEqual({
          groupIndex: 0,
          diceIndex: i,
        });
      }
    });

    it("applies the correct labels to dice", () => {
      const d6 = Dice.fromDiceString("1d6");
      const d8 = Dice.fromDiceString("2d8");
      const group = DiceGroup.of(d6, d8);

      const exprGroup = group.standardize();

      // Check labels are correctly applied
      let found = 0;
      exprGroup.exprs.forEach((expr, i) => {
        if (expr.label[DiceGroup.GroupLabel]) {
          expect(
            expr.label[DiceGroup.GroupLabel],
            `label for expr ${i}`,
          ).toEqual({
            groupIndex: found++,
            diceIndex: 0,
          });
        }
      });

      expect(found).toBe(2);
    });
  });

  describe("asDice", () => {
    it("extracts Dice from DiceExprNodes", () => {
      const d6 = Dice.fromDiceString("1d6");
      const d20 = Dice.fromDiceString("1d20");
      const group = DiceGroup.of(d6, d20).asExprGroup();

      const dice = group.flattenDice();
      expect(dice.length).toBe(2);
      expect(dice[0].dice).toBe(d6);
      expect(dice[1].dice).toBe(d20);
    });

    it("extracts Dice from complex expressions", () => {
      const dice = [
        new DiceExprNode(Dice.fromDiceString("1d6"), {}),
        new DiceExprNode(Dice.fromDiceString("2d8"), {}),
        parseDiceExpression("1d4 + 3"),
      ];

      const group = new DiceExprGroup(dice);
      const extractedDice = group.flattenDice();

      expect(extractedDice.length).toBe(3);
      expect(extractedDice[0].toString()).toBe("1d6");
      expect(extractedDice[1].toString()).toBe("2d8");
      expect(extractedDice[2].toString()).toBe("1d4");
    });

    it("extracts multiple dice from a single complex expression", () => {
      const dice = [parseDiceExpression("1d6 + 2d8")];

      const group = new DiceExprGroup(dice);
      const extractedDice = group.flattenDice();

      expect(extractedDice.length).toBe(2);
      expect(extractedDice[0].toString()).toBe("1d6");
      expect(extractedDice[1].toString()).toBe("2d8");
    });

    it("returns an empty array for DiceGroup with no dice expressions", () => {
      const dice = [new NumberNode(5, {}), new NumberNode(10, {})];

      const group = new DiceExprGroup(dice);
      const extractedDice = group.flattenDice();

      expect(extractedDice.length).toBe(0);
    });

    it("works with deeply nested expressions", () => {
      const dice = [parseDiceExpression("(3d12 + 2) * (1d4 - 1)")];

      const group = new DiceExprGroup(dice);
      const extractedDice = group.flattenDice();

      expect(extractedDice.length).toBe(2);
      expect(extractedDice[0].toString()).toBe("3d12");
      expect(extractedDice[1].toString()).toBe("1d4");
    });
  });
});

describe("DiceExprGroup", () => {
  describe("applyValues", () => {
    it("applies roll results to dice expressions", () => {
      const d6 = new DiceExprNode(Dice.fromDiceString("1d6"), {});
      const d8 = new DiceExprNode(Dice.fromDiceString("2d8"), {});
      const group = new DiceExprGroup([d6, d8]);

      const results = [{ rolls: [4] }, { rolls: [6, 4] }];

      const evaluated = group.applyValues(results);

      expect(evaluated.exprs.length).toBe(2);
      expect(evaluated.exprs[0].label).toMatchObject({ value: 4, rolls: [4] });
      expect(evaluated.exprs[1].label).toMatchObject({
        value: 10,
        rolls: [6, 4],
      });
    });

    it("handles complex expressions when applying values", () => {
      const expr = parseDiceExpression("2d6 + 1d4");
      const group = new DiceExprGroup([expr]);

      const results = [{ rolls: [3, 5] }, { rolls: [2] }];

      const evaluated = group.applyValues(results);

      // The sum of 3 + 5 + 2 = 10
      expect(evaluated.exprs[0].label.value).toBe(10);
    });

    it("works with an empty iterable of results", () => {
      const group = new DiceExprGroup([new NumberNode(5, {})]);
      const evaluated = group.applyValues([]);

      expect(evaluated.exprs[0].label.value).toBe(5);
    });
  });

  describe("standardize", () => {
    it("converts non-standard dice to standard dice", () => {
      const expr = parseDiceExpression("1d9 + 2");
      const group = new DiceExprGroup([expr]);

      const standardized = group.standardize("originalExpr");

      // The d9 should be expanded to equivalent standard dice
      const diceNodes = standardized.flattenDice();
      expect(diceNodes.length).toBeGreaterThan(1);
      expect(diceNodes.every((d) => d.dice.standard)).toBe(true);
    });

    it("works without a label key parameter", () => {
      const expr = parseDiceExpression("1d10");
      const group = new DiceExprGroup([expr]);

      const standardized = group.standardize();

      // Should complete without errors
      expect(standardized).toBeInstanceOf(DiceExprGroup);
      expect(standardized.exprs.length).toBe(1);
    });

    it("preserves the structure of expressions after standardization", () => {
      const expr = parseDiceExpression("(2d6 + 3) * 2");
      const group = new DiceExprGroup([expr]);

      const standardized = group.standardize();

      // Still should evaluate to the same range
      const originalRange = calcRange(expr);
      const standardRange = calcRange(standardized.exprs[0]);
      expect(standardRange).toEqual(originalRange);
    });
  });
});
