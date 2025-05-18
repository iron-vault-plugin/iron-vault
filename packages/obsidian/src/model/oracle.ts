import { type Datasworn } from "@datasworn/core";

import { AsyncDiceRoller, Dice, DiceRoller } from "@ironvault/dice";
import { scopeSource, scopeTags } from "datastore/datasworn-symbols";
import { NumberRange, Roll } from "./rolls";

export interface RollContext {
  /** Fetch the oracle with this ID if it exists. */
  lookup(id: string): Oracle | undefined;

  /** Dice roller to use for oracle rolls */
  diceRoller(): AsyncDiceRoller & DiceRoller;

  /** If cursed die is enabled, return the Dice object for a cursed dice. */
  cursedDice(): Dice | undefined;
}

export enum OracleGroupingType {
  Ruleset = "ruleset",
  Collection = "collection",
}

export interface OracleCollectionGrouping {
  readonly grouping_type: OracleGroupingType.Collection;
  readonly id: string;
  readonly parent: OracleGrouping;
  readonly name: string;
  readonly [scopeSource]: Datasworn.SourceInfo;
  readonly [scopeTags]: Datasworn.Tags;
}

export interface OracleRulesetGrouping {
  readonly grouping_type: OracleGroupingType.Ruleset;
  readonly id: string;
  readonly name: string;
}

export enum CurseBehavior {
  AddResult = "add_result",
  ReplaceResult = "replace_result",
}

export type OracleGrouping = OracleRulesetGrouping | OracleCollectionGrouping;

export interface Oracle {
  readonly id: string;
  readonly name: string;
  readonly parent: OracleCollectionGrouping;
  readonly rollableRows: OracleRollableRow[];
  readonly dice: Dice;

  readonly [scopeSource]: Datasworn.SourceInfo;
  readonly [scopeTags]: Datasworn.Tags;

  // TODO(@cwegrzyn): exposed raw rollable for use in the oracle reference modal. not sure
  //   to what extent it is useful to abstract some of this stuff away...
  readonly raw: Datasworn.OracleRollable | Datasworn.EmbeddedOracleRollable;
  cursedBy(rollContext: RollContext): Oracle | undefined;
  readonly curseBehavior?: CurseBehavior;
  readonly recommended_rolls?: NumberRange;

  row(value: number): OracleRow;

  roll(context: RollContext): Promise<Roll>;
  rollDirect(context: RollContext): Roll;
  // TODO: with variants, can we eliminate this? or is there a better way to deal with the
  // specificity of the randomizer ("value")?
  evaluate(context: RollContext, value: number): Roll;
  // TODO: this feels kludgey
  variants(context: RollContext, roll: Roll): Record<string, Roll>;
}

// TODO: template currently relies on re-exporting datasworn
export interface OracleRow {
  readonly template: Datasworn.OracleRollTemplate | undefined;
  readonly result: string;

  /** The roll range corresponding to this row. A null range corresponds to an unrollable row,
   * included for display purposes only.
   */
  readonly range: NumberRange | null;
}

export type OracleRollableRow = OracleRow & {
  readonly range: NonNullable<OracleRow["range"]>;
};
