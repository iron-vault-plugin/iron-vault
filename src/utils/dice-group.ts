import IronVaultPlugin from "index";
import { Dice, randomInt } from "./dice";
import { RollResult } from "@3d-dice/dice-box";

export class DiceGroup {
  constructor(
    public dice: Dice[],
    private plugin: IronVaultPlugin,
  ) {}

  async roll(displayDice: boolean): Promise<RollResult[]> {
    if (!displayDice) {
      return this.dice.map((d) => {
        return { value: randomInt(d.minRoll(), d.maxRoll()) } as RollResult;
      });
    }
    return await this.plugin.diceOverlay.roll(
      this.dice.map((d) => ({
        qty: d.count,
        sides: d.sides,
        themeColor: d.themeColor,
      })),
    );
  }
}
