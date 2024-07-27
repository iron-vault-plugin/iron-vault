import IronVaultPlugin from "index";
import { Dice, DieKind, randomInt } from "./dice";
import { DiceGroup } from "./dice-group";

export type DiceResult = { dice: Dice; value: number };

export interface DiceRoller {
  roll(group: DiceGroup): DiceResult[];
}

export interface AsyncDiceRoller {
  rollAsync(group: DiceGroup): Promise<DiceResult[]>;
}

export class PlainDiceRoller implements DiceRoller, AsyncDiceRoller {
  static readonly INSTANCE = new PlainDiceRoller();

  roll(group: DiceGroup): DiceResult[] {
    return group.dice.map((dice) => {
      return {
        value: randomInt(dice.minRoll(), dice.maxRoll()),
        dice,
      };
    });
  }

  rollAsync(group: DiceGroup): Promise<DiceResult[]> {
    return Promise.resolve(this.roll(group));
  }
}

export class GraphicalDiceRoller implements DiceRoller, AsyncDiceRoller {
  constructor(readonly plugin: IronVaultPlugin) {}

  roll(group: DiceGroup): DiceResult[] {
    return PlainDiceRoller.INSTANCE.roll(group);
  }

  async rollAsync(group: DiceGroup): Promise<DiceResult[]> {
    const rawResults = await this.plugin.diceOverlay.roll(
      group.dice.map((d) => ({
        qty: d.count,
        sides: d.sides,
        themeColor: this.themeColor(d.kind),
      })),
    );
    return rawResults.map((roll, idx) => ({
      dice: group.dice[idx],
      // @3d-dice return "0" for percentile dice when when both are "0"/"00", instead of "100"
      value: roll.sides === 100 && roll.value === 0 ? 100 : roll.value,
    }));
  }

  themeColor(kind: DieKind | undefined): string | undefined {
    switch (kind) {
      case DieKind.Action:
        return this.plugin?.settings.actionDieColor;
      case DieKind.Challenge1:
        return this.plugin?.settings.challengeDie1Color;
      case DieKind.Challenge2:
        return this.plugin?.settings.challengeDie2Color;
      case DieKind.Oracle:
        return this.plugin?.settings.oracleDiceColor;
      case DieKind.Cursed:
        return this.plugin?.settings.cursedDieColor;
      default:
        return;
    }
  }
}
