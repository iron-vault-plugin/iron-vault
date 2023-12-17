import { type OracleTable, type OracleTableRow } from "dataforged";

export interface BaseRoll {
  kind: "simple" | "multi" | "templated";
  roll: number;
  table: OracleTable;
  row: OracleTableRow;
}
export interface SimpleRoll extends BaseRoll {
  kind: "simple";
}
export interface MultiRoll extends BaseRoll {
  kind: "multi";
  results: Roll[];
}
export interface TemplatedRoll extends BaseRoll {
  kind: "templated";
  templateRolls: Map<string, Roll>;
}
export type Roll = SimpleRoll | MultiRoll | TemplatedRoll;

export function sameRoll(roll1: Roll, roll2: Roll): boolean {
  if (
    roll1.kind !== roll2.kind ||
    roll1.table.$id !== roll2.table.$id ||
    roll1.row.$id !== roll2.table.$id
  )
    return false;

  if (roll1.kind === "multi" && roll2.kind === "multi") {
    // Two multi rolls are the same if they have the same length and each subroll is
    // present in the other
    return (
      roll1.results.length === roll2.results.length &&
      roll1.results.every(
        (subroll1) =>
          roll2.results.find((subroll2) => sameRoll(subroll1, subroll2)) !=
          null,
      )
    );
  } else if (roll1.kind === "templated" && roll2.kind === "templated") {
    for (const [k1, v1] of roll1.templateRolls) {
      const v2 = roll2.templateRolls.get(k1);
      if (v2 == null || !sameRoll(v1, v2)) return false;
    }
  }
  // a simple roll -- these must be the same
  return true;
}
