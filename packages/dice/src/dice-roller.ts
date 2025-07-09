import { Dice, ExprNode, isDiceExprNode } from "./dice";
import { DiceGroup } from "./dice-group";

export type DiceResult = {
  dice: Dice;
  value: number;
  rolls: number[];
  exprs?: ExprNode<{ rolls?: number[]; value: number }>[];
};

export interface DiceRoller {
  roll(group: DiceGroup): DiceResult[];
}

export interface AsyncDiceRoller {
  rollAsync(group: DiceGroup): Promise<DiceResult[]>;
}

export class PlainDiceRoller implements DiceRoller, AsyncDiceRoller {
  static readonly INSTANCE: PlainDiceRoller = new PlainDiceRoller();

  roll(group: DiceGroup): DiceResult[] {
    return group.dice.map((dice) => {
      const rolls = [...dice.rolls()];
      const value = rolls.reduce((sum, roll) => sum + roll, 0);
      return { value, dice, rolls };
    });
  }

  rollAsync(group: DiceGroup): Promise<DiceResult[]> {
    return Promise.resolve(this.roll(group));
  }
}

class ProxyAsyncDiceRollerImpl implements DiceRoller, AsyncDiceRoller {
  #roller: DiceRoller;

  constructor(roller: DiceRoller) {
    this.#roller = roller;
  }

  roll(group: DiceGroup): DiceResult[] {
    return this.#roller.roll(group);
  }

  rollAsync(group: DiceGroup): Promise<DiceResult[]> {
    return Promise.resolve(this.#roller.roll(group));
  }
}

export function asyncifyRoller(
  roller: DiceRoller,
): AsyncDiceRoller & DiceRoller {
  return new ProxyAsyncDiceRollerImpl(roller);
}

export class StandardizingDiceRoller implements DiceRoller, AsyncDiceRoller {
  #roller: AsyncDiceRoller & DiceRoller;

  constructor(innerRoller: AsyncDiceRoller & DiceRoller) {
    this.#roller = innerRoller;
  }

  roll(group: DiceGroup): DiceResult[] {
    const [standardized, next] = rollGroupWithStandardDice(group);
    return next(this.#roller.roll(standardized));
  }

  async rollAsync(group: DiceGroup): Promise<DiceResult[]> {
    const [standardized, next] = rollGroupWithStandardDice(group);
    return next(await this.#roller.rollAsync(standardized));
  }
}

export function rollGroupWithStandardDice(
  group: DiceGroup,
): [DiceGroup, (rawResults: DiceResult[]) => DiceResult[]] {
  const standardized = group.standardize();
  const standardizedGroup = new DiceGroup(
    standardized.flattenDice().map((expr) => expr.dice),
  );

  return [
    standardizedGroup,
    (rawResults: DiceResult[]) => {
      // logger.debug("Raw results", rawResults);

      const evaluated = standardized.applyValues(rawResults);

      // logger.debug("Parsed results", evaluated);
      // this.diceOverlay.setMessage(
      //   `Rolled ${evaluated.exprs
      //     .map(
      //       (expr) =>
      //         `${expr.label[DiceGroup.GroupLabel]?.groupIndex}.${expr.label[DiceGroup.GroupLabel]?.diceIndex}: ${toStringWithValues(expr)}`,
      //     )
      //     .join("\n\n")}`,
      // );

      const results: DiceResult[] = group.dice.map((dice) => ({
        dice,
        value: 0,
        rolls: [],
      }));

      for (const expr of evaluated.exprs) {
        const { groupIndex, diceIndex } =
          expr.label[DiceGroup.GroupLabel] || {};
        if (groupIndex === undefined || diceIndex === undefined) {
          throw new Error(
            `Dice expression ${expr.toString()} does not have group or dice index labels`,
          );
        }
        results[groupIndex].value += expr.label.value;
        // If this is a dice expression node, we'll have rolls. Otherwise, this is a complex
        // expression and so the value is the roll.
        results[groupIndex].rolls.push(
          ...(expr.label.rolls ? expr.label.rolls : [expr.label.value]),
        );

        if (!isDiceExprNode(expr)) {
          results[groupIndex].exprs ??= [];
          results[groupIndex].exprs.push(expr);
        }
      }

      return results;
    },
  ];
}
