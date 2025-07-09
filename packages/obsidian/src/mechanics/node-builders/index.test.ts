import {
  evaluateExpr,
  parseDiceExpression,
  rollsFromIterator,
} from "@ironvault/dice";
import { node } from "utils/kdl";
import { describe, expect, it } from "vitest";
import { createDiceExpressionNode } from "./index";

describe("createDiceExpressionNode", () => {
  it("should create a node with correct structure for simple expression", () => {
    const evaledExpr = evaluateExpr(
      parseDiceExpression("1d6+1"),
      rollsFromIterator([{ rolls: [6] }]),
    );

    const result = createDiceExpressionNode({ evaledExpr });

    expect(result).toEqual(
      node("dice-expr", {
        properties: { expr: "1d6 + 1", result: 7 },
        children: [
          node("rolls", {
            values: [6],
            properties: { dice: "1d6" },
          }),
        ],
      }),
    );
  });

  it("should create a node with correct structure for multiple dice rolls", () => {
    // Mock an expression with multiple dice expressions
    const evaledExpr = evaluateExpr(
      parseDiceExpression("2d6+2d4"),
      rollsFromIterator([{ rolls: [5, 3] }, { rolls: [1, 1] }]),
    );

    const result = createDiceExpressionNode({ evaledExpr });

    expect(result).toEqual(
      node("dice-expr", {
        properties: { expr: "2d6 + 2d4", result: 10 },
        children: [
          node("rolls", {
            values: [5, 3],
            properties: { dice: "2d6" },
          }),
          node("rolls", {
            values: [1, 1],
            properties: { dice: "2d4" },
          }),
        ],
      }),
    );
  });

  it("should handle expressions without dice rolls correctly", () => {
    const evaledExpr = evaluateExpr(
      parseDiceExpression("5"),
      rollsFromIterator([]),
    );

    const result = createDiceExpressionNode({ evaledExpr });

    expect(result).toEqual(
      node("dice-expr", {
        properties: { expr: "5", result: 5 },
        children: [],
      }),
    );
  });

  it("should handle expressions without dice rolls correctly", () => {
    const evaledExpr = evaluateExpr(
      parseDiceExpression("5"),
      rollsFromIterator([]),
    );

    const result = createDiceExpressionNode({ evaledExpr });

    expect(result).toEqual(
      node("dice-expr", {
        properties: { expr: "5", result: 5 },
        children: [],
      }),
    );
  });
});
