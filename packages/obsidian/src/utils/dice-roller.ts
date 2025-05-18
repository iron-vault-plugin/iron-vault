import {
  AsyncDiceRoller,
  DiceGroup,
  DiceResult,
  DiceRoller,
  PlainDiceRoller,
} from "@ironvault/dice";
import IronVaultPlugin from "index";
import { rootLogger } from "logger";

const logger = rootLogger.getLogger("dice-roller");

export { PlainDiceRoller } from "@ironvault/dice";
export type { AsyncDiceRoller, DiceResult, DiceRoller } from "@ironvault/dice";

export enum DieKind {
  Action = "action",
  Challenge1 = "challenge1",
  Challenge2 = "challenge2",
  Oracle = "oracle",
  Cursed = "cursed",
}

export class GraphicalDiceRoller implements DiceRoller, AsyncDiceRoller {
  constructor(readonly plugin: IronVaultPlugin) {}

  roll(group: DiceGroup): DiceResult[] {
    return PlainDiceRoller.INSTANCE.roll(group);
  }

  async rollAsync(group: DiceGroup): Promise<DiceResult[]> {
    const standardized = group.asExprGroup().standardize();
    const rolls = standardized.flattenDice().map((d) => ({
      qty: d.count,
      sides: d.sides,
      themeColor: this.themeColor(d.kind),
      dice: d,
    }));

    logger.debug(
      "Rolling dice %s standardized to %s using %o",
      group.dice.map((x) => x.toString()),
      standardized.exprs.map((x) => x.toString()),
      rolls,
    );
    const rawResults = await this.plugin.diceOverlay.roll(rolls);
    logger.debug("Raw results", rawResults);

    const groupedResults = rolls.map(({ dice }, idx) => ({
      dice,
      // @3d-dice return "0" for percentile dice when when both are "0"/"00", instead of "100"
      value: rawResults
        .filter((r) => r.groupId == idx)
        .reduce(
          (acc, r) => acc + (r.sides === 100 && r.value === 0 ? 100 : r.value),
          0,
        ),
    }));
    const parsed = standardized.fromValues(groupedResults);

    if (this.plugin.settings.diceRollerDebug) {
      this.plugin.diceOverlay.setMessage(
        `Rolled ${standardized
          .toStringWithValues(groupedResults)
          .map((res, i) => `${group.dice[i]} -> ${res} = ${parsed[i].value}`)
          .join("\n\n")}`,
      );
    }

    logger.debug("Parsed results", parsed);
    return group.dice.map((dice, idx) => ({
      value: parsed[idx].value,
      dice,
    }));
  }

  themeColor(kind: DieKind | string | undefined): string | undefined {
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
