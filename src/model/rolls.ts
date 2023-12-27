import { RollSchema } from "../oracles/schema";
import { Oracle, RollContext } from "./oracle";

// TODO: better reference for origin of roll?
export interface BaseRoll {
  kind: "simple" | "multi" | "templated";
  roll: number;
  tableId: string;
  rowId: string;
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
    roll1.tableId !== roll2.tableId ||
    roll1.rowId !== roll2.tableId
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
