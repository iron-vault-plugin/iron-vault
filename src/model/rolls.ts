import { RollSchema } from "../oracles/schema";
import { Oracle, RollContext } from "./oracle";

// TODO: better reference for origin of roll?
export interface Roll {
  /**
   * Dice roll corresponding to table
   */
  roll: number;
  tableId: string;
  rowId: string;

  /**
   * Subsidiary result rolls
   */
  subrolls: Roll[];
}

export function sameRoll(roll1: Roll, roll2: Roll): boolean {
  // Rolls must have the same table, row
  if (roll1.tableId !== roll2.tableId || roll1.rowId !== roll2.rowId)
    return false;

  // If subrolls are present, rolls are the same if they have the same number of subrolls
  // and each subroll is present in the other list
  return (
    roll1.subrolls.length === roll2.subrolls.length &&
    roll1.subrolls.every(
      (subroll1) =>
        roll2.subrolls.find((subroll2) => sameRoll(subroll1, subroll2)) != null,
    )
  );
}

export function dehydrateRoll(
  context: RollContext,
  rollData: Roll,
): RollSchema {
  const { kind, tableId, rowId, roll } = rollData;
  const table = context.lookup(tableId);
  if (table == null) {
    throw new Error(`missing table ${tableId}`);
  }
  const row = table.row(rowId);
  if (row == null) {
    throw new Error(`missing row ${rowId} on table ${tableId}`);
  }
  const baseData = {
    roll,
    tableId,
    tableName: table.name,
  };
  switch (kind) {
    case "simple":
      return {
        kind,
        ...baseData,
        results: [row.result],
      };
    case "multi": {
      const rolls = rollData.results.map((r) => dehydrateRoll(context, r));
      return {
        kind,
        ...baseData,
        rolls,
        raw: row.result,
        results: Array.combine(rolls.map((r) => r.results)),
      };
    }
    case "templated": {
      const templateRolls: Record<string, RollSchema> = {};
      const templateString = row.template?.result;
      if (templateString == null) {
        throw new Error(
          `expected template result for ${row.id} of ${table.id}`,
        );
      }

      for (const [k, v] of rollData.templateRolls.entries()) {
        templateRolls[k] = dehydrateRoll(context, v);
      }

      return {
        kind,
        ...baseData,
        raw: row.result,
        templateRolls,
        templateString,
        results: [
          templateString.replace(
            /\{\{result:([^{}]+)\}\}/g,
            (_: any, id: string) => {
              // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
              return templateRolls[id].results.join("; ");
            },
          ),
        ],
      };
    }
  }
}

export class RollWrapper {
  private _dehydrated?: RollSchema;

  constructor(
    public readonly oracle: Oracle,
    public readonly context: RollContext,
    public readonly roll: Roll = oracle.roll(context),
  ) {}

  get variants(): Readonly<Record<string, RollWrapper>> {
    return Object.fromEntries(
      Object.entries(this.oracle.variants(this.context, this.roll)).map(
        ([k, v]) => [k, new RollWrapper(this.oracle, this.context, v)],
      ),
    );
  }

  dehydrate(): RollSchema {
    return (
      this._dehydrated ||
      (this._dehydrated = dehydrateRoll(this.context, this.roll))
    );
  }

  get simpleResult(): string {
    return this.dehydrate().results.join(", ");
  }

  reroll(): RollWrapper {
    return new RollWrapper(this.oracle, this.context);
  }
}
