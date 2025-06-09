import {
  AsyncDiceRoller,
  DiceGroup,
  DiceResult,
  DiceRoller,
  PlainDiceRoller,
  rollGroupWithStandardDice,
  toStringWithValues,
} from "@ironvault/dice";
import IronVaultPlugin from "index";
import { rootLogger } from "logger";
import { IDiceOverlay } from "./dice-overlay";

export { PlainDiceRoller } from "@ironvault/dice";
export type { AsyncDiceRoller, DiceResult, DiceRoller } from "@ironvault/dice";

const logger = rootLogger.getLogger("dice-roller");

export enum DieKind {
  Unknown = "unknown",
  Action = "action",
  Challenge1 = "challenge1",
  Challenge2 = "challenge2",
  Oracle = "oracle",
  Cursed = "cursed",
}

export class GraphicalDiceRoller implements DiceRoller, AsyncDiceRoller {
  diceOverlay: IDiceOverlay;
  colorMap: Map<string, string>;

  constructor(plugin: IronVaultPlugin) {
    this.diceOverlay = plugin.diceOverlay;
    if (!this.diceOverlay) {
      throw new Error("Dice overlay is not initialized");
    }
    this.colorMap = plugin.settings.colorMap();
  }

  roll(group: DiceGroup): DiceResult[] {
    return PlainDiceRoller.INSTANCE.roll(group);
  }

  async rollAsync(group: DiceGroup): Promise<DiceResult[]> {
    if (group.dice.length === 0) {
      return [];
    }

    // This roller doesn't support non-standard dice, so we have to standardize any
    // non-standard dice before rolling.
    const [standardized, evaluate] = rollGroupWithStandardDice(group);

    const rolls = standardized.dice.map((dice) => ({
      qty: dice.count,
      sides: dice.sides,
      themeColor: this.colorMap.get(dice.kind ?? DieKind.Unknown),
      dice,
    }));

    logger.debug(
      "Rolling dice %s via standardization %s",
      group.dice.map((x) => x.toString()),
      standardized.dice.map((x) => x.toString()),
    );
    const rawResults = await this.diceOverlay.roll(rolls);
    const groupedResults: DiceResult[] = rolls.map(({ dice }, idx) => {
      const rolls = rawResults
        .filter((r) => r.groupId == idx)
        // @3d-dice return "0" for percentile dice when when both are "0"/"00", instead of "100"
        .map((r) => (r.sides === 100 && r.value === 0 ? 100 : r.value));
      return {
        dice,
        rolls,
        value: rolls.reduce((acc, r) => acc + r, 0),
      };
    });

    const evaluated = evaluate(groupedResults);

    logger.debug("Parsed results", evaluated);
    this.diceOverlay.setMessage(
      `Rolled ${evaluated
        .map(
          (res) =>
            `${res.dice} -> ${res.exprs ? res.exprs.map((expr) => toStringWithValues(expr)).join(", ") : res.rolls.join(", ")}`,
        )
        .join("\n\n")}`,
    );
    return evaluated;
  }
}
