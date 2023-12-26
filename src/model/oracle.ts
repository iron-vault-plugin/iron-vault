import { OracleRollTemplate } from "@datasworn/core";
import { Roll } from "./rolls";

export interface RollContext {
  lookup(id: string): Oracle | undefined;
}

export interface Oracle {
  readonly id: string;
  readonly name: string;
  readonly parentId: string | null;
  readonly category: string;

  row(id: string): OracleRow | undefined;

  roll(context: RollContext): Roll;
  // TODO: with variants, can we eliminate this? or is there a better way to deal with the
  // specificity of the randomizer ("value")?
  evaluate(context: RollContext, value: number): Roll;
  // TODO: this feels kludgey
  variants(context: RollContext, roll: Roll): Record<string, Roll>;
}

// TODO: template currently relies on re-exporting datasworn
export interface OracleRow {
  readonly template: OracleRollTemplate | undefined;
  readonly id: string;
  readonly result: string;
}
