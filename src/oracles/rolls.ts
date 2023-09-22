import {
  type OracleTableRow,
  type OracleBase,
  type OracleTable,
} from "dataforged";
import { randomInt } from "../utils/dice";

interface BaseRoll {
  kind: "simple" | "multi" | "templated";
  roll: number;
  table: OracleTable;
  row: OracleTableRow;
}
interface SimpleRoll extends BaseRoll {
  kind: "simple";
}
interface MultiRoll extends BaseRoll {
  kind: "multi";
  results: Roll[];
}
interface TemplatedRoll extends BaseRoll {
  kind: "templated";
  templateRolls: Map<string, Roll>;
}
export type Roll = SimpleRoll | MultiRoll | TemplatedRoll;
function sameRoll(roll1: Roll, roll2: Roll): boolean {
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
export class OracleRoller {
  constructor(protected index: Map<string, OracleBase>) {}

  roll(oracle: OracleTable): Roll {
    const roll = randomInt(1, 100);
    return this.evaluateRow(roll, oracle);
  }

  evaluateRow(roll: number, table: OracleTable): Roll {
    const row = table.Table.find(
      (row): row is OracleTableRow =>
        row.Floor != null &&
        row.Floor <= roll &&
        row.Ceiling != null &&
        roll <= row.Ceiling,
    );
    if (row == null) {
      throw new Error(`roll ${roll} is off the charts for ${table.$id}`);
    }

    console.log(row);
    if (row["Roll template"] != null) {
      const template = row["Roll template"];
      // TODO: apparently also description and summary
      if (template.Result == null) {
        throw new Error(`unhandled template for ${table.$id}`);
      }
      const templateRolls = new Map<string, Roll>();
      for (const [_match, id] of template.Result.matchAll(
        /\{\{([^{}]+)\}\}/g,
      )) {
        const subTable = this.index.get(id);
        if (subTable == null) {
          throw new Error(`missing subtable ${id} in ${table.$id}`);
        }
        // TODO: assertion somewhere that this is a table?
        const subResult = this.roll(subTable as OracleTable);
        templateRolls.set(id, subResult);
      }

      return {
        kind: "templated",
        templateRolls,
        roll,
        table,
        row,
      };
    }
    if (row.Subtable != null) {
      console.warn("subtable", row);
      throw new Error(`subtable roll ${table.$id}`);
    }
    if (row["Multiple rolls"] != null) {
      const results: Roll[] = [];
      let iterations = 0;
      while (results.length < row["Multiple rolls"].Amount) {
        if (iterations++ >= 10) {
          throw new Error("too many iterations");
        }
        const roll = this.roll(table);
        if (
          !row["Multiple rolls"]["Allow duplicates"] &&
          results.find((otherRoll) => sameRoll(roll, otherRoll)) != null
        ) {
          console.log("duplicate roll skipped", results, roll);
          continue;
        }
        results.push(roll);
      }
      return {
        kind: "multi",
        results,
        table,
        roll,
        row,
      };
    }
    if (row["Oracle rolls"] != null) {
      const subrolls = row["Oracle rolls"].map((id) => {
        const suboracle = this.index.get(id);
        if (suboracle == null)
          throw new Error(
            `missing oracle ${id} referenced in ${table.$id} Oracle rolls`,
          );
        return this.roll(suboracle as OracleTable);
      });
      return {
        kind: "multi",
        roll,
        table,
        row,
        results: subrolls,
      };
    }
    return {
      kind: "simple",
      roll,
      row,
      table,
    };
  }
}
