import {
  Dice,
  DiceExprNode,
  expandNonStandardDice,
  ExprNode,
  foldExpr,
  parenStringIf,
} from "./dice";

export class DiceGroup {
  static of(...dice: Dice[]): DiceGroup {
    return new this(dice);
  }

  constructor(public readonly dice: Dice[]) {}

  asExprGroup(): DiceExprGroup {
    return new DiceExprGroup(this.dice.map((d) => new DiceExprNode(d)));
  }
}

export class DiceExprGroup {
  flattenDice(): Dice[] {
    const ds: Dice[] = [];
    this.exprs.forEach((d) => {
      d.walk({
        visitDiceExprNode(node) {
          ds.push(node.dice);
        },
      });
    });
    return ds;
  }

  fromValues(
    results: { dice: Dice; value: number }[],
  ): { expr: ExprNode; value: number }[] {
    let index = 0;
    return this.exprs.map((expr) => {
      return {
        expr,
        value: expr.evaluate((d) => {
          const result = results[index++];
          if (!d.equals(result.dice)) {
            throw new Error(
              `Expected dice ${d.toString()} at index ${index - 1} to match ${result.dice.toString()}`,
            );
          }
          if (result == null) {
            throw new Error(
              `Missing result for dice ${d.toString()} at index ${index}`,
            );
          }
          return result.value;
        }),
      };
    });
  }

  toStringWithValues(results: { dice: Dice; value: number }[]): string[] {
    let index = 0;
    return this.exprs.map((expr) => {
      return foldExpr(expr, {
        visitDiceExprNode(node) {
          const result = results[index++];
          if (!node.dice.equals(result.dice)) {
            throw new Error(
              `Expected dice ${node.dice.toString()} at index ${index - 1} to match ${result.dice.toString()}`,
            );
          }
          if (result == null) {
            throw new Error(
              `Missing result for dice ${node.dice.toString()} at index ${index}`,
            );
          }
          return `${node.dice.toString()}@${result.value}`;
        },
        visitNumberNode(node) {
          return node.toString();
        },
        visitUnaryOpNode(node, operand) {
          return `${node.operator}${parenStringIf(node.operand.precedence < node.precedence, operand)}`;
        },
        visitBinaryOpNode(node, left, right) {
          return `${parenStringIf(node.left.precedence < node.precedence, left)} ${node.operator} ${parenStringIf(node.right.precedence < node.precedence, right)}`;
        },
      });
    });
  }

  standardize(): DiceExprGroup {
    return new DiceExprGroup(this.exprs.map(expandNonStandardDice));
  }

  constructor(public readonly exprs: ExprNode[]) {}
}
