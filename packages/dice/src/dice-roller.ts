import { Dice } from "./dice";
import { DiceGroup } from "./dice-group";

export type DiceResult = { dice: Dice; value: number };

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
      return {
        value: dice.roll(),
        dice,
      };
    });
  }

  rollAsync(group: DiceGroup): Promise<DiceResult[]> {
    return Promise.resolve(this.roll(group));
  }
}
