import { StandardIndex } from "datastore/data-indexer";
import { Oracle, RollContext } from "model/oracle";
import { RollWrapper } from "model/rolls";

export class OracleRoller implements RollContext {
  constructor(protected index: StandardIndex<Oracle>) {}

  lookup(id: string): Oracle | undefined {
    return this.index.get(id);
  }

  roll(oracle: Oracle | string): RollWrapper {
    let table: Oracle | undefined;
    if (typeof oracle === "string") {
      table = this.index.get(oracle);
      if (table == null) {
        throw new Error(`unable to find table with $id = ${oracle}`);
      }
    } else {
      table = oracle;
    }
    return new RollWrapper(table, this);
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
