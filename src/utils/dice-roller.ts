import IronVaultPlugin from "index";
import { rootLogger } from "logger";
import { Dice, DieKind } from "./dice";
import { DiceGroup } from "./dice-group";

const logger = rootLogger.getLogger("dice-roller");

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
        value: dice.roll(),
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
    const rolls = group.dice.map((d) => ({
      qty: d.count,
      sides: d.sides,
      themeColor: this.themeColor(d.kind),
    }));
    logger.trace("Rolling dice", rolls);
    const rawResults = await this.plugin.diceOverlay.roll(rolls);
    logger.trace("Raw results", rawResults);
    return group.dice.map((d, idx) => ({
      dice: d,
      // @3d-dice return "0" for percentile dice when when both are "0"/"00", instead of "100"
      value: rawResults
        .filter((r) => r.groupId == idx)
        .reduce(
          (acc, r) => acc + (r.sides === 100 && r.value === 0 ? 100 : r.value),
          0,
        ),
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
