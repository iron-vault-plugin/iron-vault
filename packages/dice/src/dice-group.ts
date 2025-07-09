import "es-iterator-helpers/auto";

import { numberRangeExclusive } from "@ironvault/utils/numbers";
import {
  convertToStandardDiceCached,
  Dice,
  DiceExprNode,
  evaluateExpr,
  expandNonStandardDice,
  ExprNode,
  isStandardDice,
  rollsFromIterator,
} from "./dice";

export class DiceGroup {
  static readonly GroupLabel: unique symbol = Symbol("diceGroup");

  static of(...dice: Dice[]): DiceGroup {
    return new this(dice);
  }

  constructor(public readonly dice: Dice[]) {}

  equals(other: DiceGroup): boolean {
    if (this.dice.length !== other.dice.length) return false;
    for (let i = 0; i < this.dice.length; i++) {
      if (!this.dice[i].equals(other.dice[i])) return false;
    }
    return true;
  }

  asExprGroup(): DiceExprGroup {
    return new DiceExprGroup(this.dice.map((d) => new DiceExprNode(d, {})));
  }

  standardize(): DiceExprGroup<{
    [DiceGroup.GroupLabel]?: { groupIndex: number; diceIndex: number };
  }> {
    let index = 0;
    return new DiceExprGroup(
      this.dice.flatMap((d) => {
        const groupIndex = index++;
        if (isStandardDice(d)) {
          return [
            new DiceExprNode(d, {
              [DiceGroup.GroupLabel]: { groupIndex, diceIndex: 0 },
            }),
          ];
        } else {
          const std = convertToStandardDiceCached(d.sides, d.kind);
          return numberRangeExclusive(0, d.count).map((diceIndex) =>
            std.updateLabels((l) => ({
              ...l,
              [DiceGroup.GroupLabel]: { groupIndex, diceIndex },
            })),
          );
        }
      }),
    );
  }
}

export class DiceExprGroup<L extends object = object> {
  constructor(public readonly exprs: ExprNode<L>[]) {}

  flattenDice(): DiceExprNode<L>[] {
    const ds: DiceExprNode<L>[] = [];
    for (const expr of this.exprs) {
      expr.walk({
        visitDiceExprNode: (node) => {
          ds.push(node);
        },
      });
    }
    return ds;
  }

  flattenDiceToGroup(): DiceGroup {
    return new DiceGroup(this.flattenDice().map((expr) => expr.dice));
  }

  applyValues(
    results: Iterable<{
      rolls: number[];
    }>,
  ): DiceExprGroup<L & { value: number; rolls?: number[] }> {
    const iter = Iterator.from(results);
    return new DiceExprGroup(
      this.exprs.map((expr) => evaluateExpr(expr, rollsFromIterator(iter))),
    );
  }

  standardize<const K extends symbol | string>(
    origLabel?: K,
  ): DiceExprGroup<
    L & {
      [key in K]?: { origDiceLabel: ExprNode<L>; index: number; root: boolean };
    }
  > {
    return new DiceExprGroup(
      this.exprs.map((expr) =>
        // Only label the root nodes
        expandNonStandardDice(expr, (l, isNewRoot, originalExpr, index) =>
          origLabel
            ? {
                ...l,
                [origLabel]: { expr: originalExpr, index, root: isNewRoot },
              }
            : l,
        ),
      ),
    );
  }
}
