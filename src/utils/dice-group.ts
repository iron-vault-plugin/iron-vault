import IronVaultPlugin from "index";
import { Dice } from "./dice";
import { RollResult } from "@3d-dice/dice-box";

export class DiceGroup {
  constructor(
    public dice: Dice[],
    private plugin: IronVaultPlugin,
  ) {}

  async roll(): Promise<RollResult[]> {
    return await this.plugin.diceOverlay.roll(
      this.dice.map((d) => ({
        qty: d.count,
        sides: d.sides,
        // themeColor: "dark",
      })),
    );
  }
}
