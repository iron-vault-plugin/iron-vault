import { type OracleTable, type OracleTableRow } from "dataforged";
import { type OracleIndex } from "datastore";
import { randomInt } from "../utils/dice";
import { type RollSchema } from "./schema";

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
export class OracleRoller {
  constructor(protected index: OracleIndex) {}

  roll(oracle: OracleTable | string): Roll {
    const roll = randomInt(1, 100);
    let table: OracleTable | undefined;
    if (typeof oracle === "string") {
      table = this.index.getTable(oracle);
      if (table == null) {
        throw new Error(`unable to find table with $id = ${oracle}`);
      }
    } else {
      table = oracle;
    }
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

export class TableWrapper {
  constructor(
    public readonly value: OracleTable,
    public readonly roller: OracleRoller,
  ) {}

  roll(): RollWrapper {
    return new RollWrapper(this.roller.roll(this.value), this);
  }

  fixedRow(roll: number): RollWrapper {
    return new RollWrapper(this.roller.evaluateRow(roll, this.value), this);
  }

  maxRoll(): number {
    // TODO: i think new schema might have a different way of doing this
    return Math.max(
      ...this.value.Table.flatMap((row) =>
        row.Ceiling != null ? [row.Ceiling] : [],
      ),
    );
  }
}

export class RollWrapper {
  protected _flip: RollWrapper | undefined;

  constructor(
    public readonly value: Roll,
    public readonly table: TableWrapper,
  ) {}

  get flip(): RollWrapper {
    if (this._flip == null) {
      this._flip = this.table.fixedRow(this.table.maxRoll() - this.value.roll);
    }
    return this._flip;
  }

  dehydrate(): RollSchema {
    return dehydrateRoll(this.value);
  }
}

export function dehydrateRoll(rollData: Roll): RollSchema {
  const { kind, table, row, roll } = rollData;
  const baseData = {
    roll,
    tableId: table.$id,
    tableName: table.Title.Standard,
  };
  switch (kind) {
    case "simple":
      return {
        kind,
        ...baseData,
        results: [row.Result],
      };
    case "multi": {
      const rolls = rollData.results.map((r) => dehydrateRoll(r));
      return {
        kind,
        ...baseData,
        rolls,
        raw: row.Result,
        results: Array.combine(rolls.map((r) => r.results)),
      };
    }
    case "templated": {
      const templateRolls: Record<string, RollSchema> = {};
      const templateString = row["Roll template"]?.Result;
      if (templateString == null) {
        throw new Error(
          `expected template result for ${row.$id} of ${table.$id}`,
        );
      }

      for (const [k, v] of rollData.templateRolls.entries()) {
        templateRolls[k] = dehydrateRoll(v);
      }

      return {
        kind,
        ...baseData,
        raw: row.Result,
        templateRolls,
        templateString,
        results: [
          templateString.replace(/\{\{([^{}]+)\}\}/g, (_match, id) => {
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            return templateRolls[id].results.join("; ");
          }),
        ],
      };
    }
  }
}
// export function hydrateRoll(index: OracleIndex, rollData: RollSchema): Roll {
//   const { kind, roll, table: tableId, row: rowId } = rollData;
//   const table = index.getTable(tableId);
//   if (table == null) {
//     throw new Error(`oracle table with id ${tableId} not found in index`);
//   }

//   // TODO: use information present (static result values)
//   const row = table.Table.find(
//     (row): row is OracleTableRow => "$id" in row && row.$id === rowId,
//   );
//   if (row == null) {
//     throw new Error(`missing oracle row ${rowId} in oracle table ${tableId}`);
//   }
//   switch (kind) {
//     case "simple":
//       return { kind, roll, table, row };
//     case "multi":
//       return {
//         kind,
//         roll,
//         table,
//         row,
//         results: rollData.results.map((r) => hydrateRoll(index, r)),
//       };
//     case "templated": {
//       const templateRolls = new Map();
//       for (const [k, v] of Object.entries(rollData.templateRolls)) {
//         templateRolls.set(k, hydrateRoll(index, v));
//       }
//       return {
//         kind,
//         roll,
//         table,
//         row,
//         templateRolls,
//       };
//     }
//   }
// }
