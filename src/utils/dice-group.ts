import { Dice } from "./dice";

export class DiceGroup {
  static of(...dice: Dice[]): DiceGroup {
    return new this(dice);
  }

  constructor(public readonly dice: Dice[]) {}
}
