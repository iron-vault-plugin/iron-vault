import { describe, expect, it } from "vitest";
import { Dice, DiceExprNode, NumberNode, parseDiceExpression } from "./dice";
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

  describe("asDice", () => {
    it("extracts Dice from DiceExprNodes", () => {
      const d6 = Dice.fromDiceString("1d6");
      const d20 = Dice.fromDiceString("1d20");
      const group = DiceGroup.of(d6, d20).asExprGroup();

      const dice = group.flattenDice();
      expect(dice.length).toBe(2);
      expect(dice[0]).toBe(d6);
      expect(dice[1]).toBe(d20);
    });

    it("extracts Dice from complex expressions", () => {
      const dice = [
        new DiceExprNode(Dice.fromDiceString("1d6")),
        new DiceExprNode(Dice.fromDiceString("2d8")),
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
      const dice = [new NumberNode(5), new NumberNode(10)];

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

describe("fromValues", () => {
  it("returns values for each expression in the group", () => {
    const group = new DiceExprGroup([
      parseDiceExpression("1d6 + 2"),
      parseDiceExpression("1d20 - 5"),
    ]);

    const [d6, d20] = group.flattenDice();

    const results = [
      { dice: d6, value: 3 },
      { dice: d20.copy(), value: 15 },
    ];

    const values = group.fromValues(results);
    expect(values.length).toBe(2);
    expect(values[0].value).toBe(5);
    expect(values[1].value).toBe(10);
  });

  it("throws an error if dice mismatch", () => {
    const d6 = Dice.fromDiceString("1d6");
    const d20 = Dice.fromDiceString("1d20");
    const group = DiceGroup.of(d6, d20).asExprGroup();

    const results = [
      { dice: d6, value: 3 },
      { dice: Dice.fromDiceString("1d10"), value: 15 },
    ];

    expect(() => {
      group.fromValues(results);
    }).toThrow(`Expected dice 1d20 at index 1 to match 1d10`);
  });
});
