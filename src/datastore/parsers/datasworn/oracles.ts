import { OracleRollable, OracleTableSimple } from "@datasworn/core";
import { RollContext, RollableOracle } from "model/oracle";
import { Roll } from "model/rolls";
import { randomInt } from "utils/dice";

export function wrapOracle(table: OracleRollable): RollableOracle {
  switch (table.oracle_type) {
    case "table_simple":
      return new TableOracle(table);
    case "table_details":
    case "column_simple":
    case "column_details":
      throw new Error(`not currently implementing ${table.oracle_type}`);
  }
}

export class TableOracle implements RollableOracle {
  constructor(protected table: OracleTableSimple) {}
  get id(): string {
    throw new Error("Method not implemented.");
  }
  evaluate(context: RollContext, value: number): Roll {
    throw new Error("Method not implemented.");
  }

  roll(context: RollContext): Roll {
    const roll = randomInt(1, 100);
    this.table.dice;
    return this.evaluateRow(roll, table);
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
      if (row["Multiple rolls"] != null) {
        console.warn(
          "Oracle %s row %s has both 'Roll template' and 'Multiple rolls'",
          table.$id,
          row.$id,
        );
      }
      const template = row["Roll template"];
      // TODO: apparently also description and summary
      if (template.Result == null) {
        throw new Error(`unhandled template for ${table.$id}`);
      }
      const templateRolls = new Map<string, Roll>();
      for (const [, id] of template.Result.matchAll(/\{\{([^{}]+)\}\}/g)) {
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
