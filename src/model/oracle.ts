import { type Datasworn } from "@datasworn/core";
import { Dice } from "utils/dice";
import { NumberRange, Roll } from "./rolls";

export interface RollContext {
  lookup(id: string): Oracle | undefined;
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
}

export interface OracleRulesetGrouping {
  readonly grouping_type: OracleGroupingType.Ruleset;
  readonly id: string;
  readonly name: string;
}

export type OracleGrouping = OracleRulesetGrouping | OracleCollectionGrouping;

export interface Oracle {
  readonly id: string;
  readonly name: string;
  readonly parent: OracleGrouping;
  readonly rollableRows: OracleRollableRow[];
  readonly dice: Dice;

  // TODO(@cwegrzyn): exposed raw rollable for use in the oracle reference modal. not sure
  //   to what extent it is useful to abstract some of this stuff away...
  readonly raw: Datasworn.OracleRollable | Datasworn.EmbeddedOracleRollable;

  row(value: number): OracleRow;

  roll(context: RollContext): Promise<Roll>;
  // TODO: with variants, can we eliminate this? or is there a better way to deal with the
  // specificity of the randomizer ("value")?
  evaluate(context: RollContext, value: number): Promise<Roll>;
  // TODO: this feels kludgey
  variants(context: RollContext, roll: Roll): Promise<Record<string, Roll>>;
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
