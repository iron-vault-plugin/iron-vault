import { BaseRollSchema, RollSchema } from "../oracles/schema";
import { Oracle, OracleRow, RollContext } from "./oracle";

// TODO: better reference for origin of roll?
export interface Roll {
  kind: RollResultKind;

  /**
   * Dice roll corresponding to table
   */
  roll: number;
  tableId: string;
  rowId: string;

  /**
   * Subsidiary result rolls
   */
  subrolls?: Record<string, Subroll<Roll>>;
}

export enum RollResultKind {
  Simple = "simple",
  Multi = "multi",
  Templated = "templated",
}

export interface Subroll<T> {
  inTemplate: boolean;
  rolls: T[];
}

export function recordsEqual<T>(
  eq: (arg1: T, arg2: T) => boolean,
): (arg1: Record<string, T>, arg2: Record<string, T>) => boolean {
  return (arg1, arg2) => {
    const keys1 = Object.keys(arg1);
    const keys2 = Object.keys(arg2);
    if (keys1.length !== keys2.length) return false;

    for (const key of keys1) {
      if (!(key in arg2)) return false;
      if (!eq(arg1[key], arg2[key])) return false;
    }

    return true;
  };
}

export function sameElementsInArray<T>(
  eq: (arg1: T, arg2: T) => boolean,
): (arg1: T[], arg2: T[]) => boolean {
  return (arg1, arg2) => {
    if (arg1.length !== arg2.length) return false;
    return arg1.every((val1) => arg2.find((val2) => eq(val1, val2)));
  };
}

export const arrayOfRollsEqual = sameElementsInArray(sameRoll);
export const subrollRecordsEqual = recordsEqual(subrollsEqual);

export function subrollsEqual(
  subroll1: Subroll<Roll>,
  subroll2: Subroll<Roll>,
): boolean {
  return (
    subroll1.inTemplate == subroll2.inTemplate &&
    arrayOfRollsEqual(subroll1.rolls, subroll2.rolls)
  );
}

export function sameRoll(roll1: Roll, roll2: Roll): boolean {
  // Rolls must have the same table, row
  if (roll1.tableId !== roll2.tableId || roll1.rowId !== roll2.rowId)
    return false;

  // If subrolls are present, rolls are the same if they have the same number of subrolls
  // and each subroll is present in the other list
  return subrollRecordsEqual(roll1.subrolls ?? {}, roll2.subrolls ?? {});
}

export class RollWrapper {
  private _subrolls?: Record<string, Subroll<RollWrapper>>;
  public readonly row: OracleRow;

  constructor(
    public readonly oracle: Oracle,
    public readonly context: RollContext,
    public readonly roll: Roll = oracle.roll(context),
  ) {
    this.row = oracle.row(roll.rowId);
  }

  get variants(): Readonly<Record<string, RollWrapper>> {
    return Object.fromEntries(
      Object.entries(this.oracle.variants(this.context, this.roll)).map(
        ([k, v]) => [k, new RollWrapper(this.oracle, this.context, v)],
      ),
    );
  }

  dehydrate(): RollSchema {
    const { kind, tableId, rowId, roll } = this.roll;
    const subrolls = Object.values(this.subrolls).flatMap((subroll) => {
      return subroll.rolls.map((r) => r.dehydrate());
    });
    const baseData: BaseRollSchema = {
      roll,
      tableId,
      tableName: this.oracle.name,
      results: this.results,
      subrolls: subrolls.length == 0 ? undefined : subrolls,
    };
    switch (kind) {
      case RollResultKind.Simple:
        return {
          kind,
          ...baseData,
        };
      case RollResultKind.Multi: {
        return {
          kind,
          ...baseData,
          raw: this.rawResult,
        };
      }
      case RollResultKind.Templated: {
        const templateString = this.row.template?.result;
        if (templateString == null) {
          throw new Error(
            `expected template result for ${rowId} of ${tableId}`,
          );
        }
        return {
          kind,
          ...baseData,
          raw: this.rawResult,
          templateString,
        };
      }
      default: {
        const k: never = kind;
        throw new Error(`unexpected kind ${k}`);
      }
    }
  }

  get simpleResult(): string {
    return this.results.join(", ");
  }

  reroll(): RollWrapper {
    return new RollWrapper(this.oracle, this.context);
  }

  get subrolls(): Record<string, Subroll<RollWrapper>> {
    if (!this._subrolls) {
      this._subrolls = {};
      for (const [key, { inTemplate, rolls }] of Object.entries(
        this.roll.subrolls ?? {},
      )) {
        const suboracle = this.context.lookup(key);
        if (!suboracle) {
          console.error(
            "[table %s] subroll has unknown table %s",
            this.oracle.id,
            key,
          );
          throw new Error(`unknown oracle ${key} in subroll`);
        }
        this._subrolls[key] = {
          inTemplate,
          rolls: rolls.map(
            (roll) => new RollWrapper(suboracle, this.context, roll),
          ),
        };
      }
    }
    return this._subrolls;
  }

  get selfRolls(): RollWrapper[] {
    return this.subrolls[this.roll.tableId]?.rolls ?? [];
  }

  get rawResult(): string {
    return this.row.result;
  }

  get results(): string[] {
    switch (this.roll.kind) {
      case RollResultKind.Simple:
        return [this.row.result];
      case RollResultKind.Multi:
        return this.selfRolls.flatMap((r) => r.results);
      case RollResultKind.Templated:
        const templateString = this.row.template?.result;
        if (templateString == null) {
          throw new Error(
            `expected template result for ${this.row.id} of ${this.oracle.id}`,
          );
        }
        return [
          templateString.replace(
            /\{\{result:([^{}]+)\}\}/g,
            (_: any, id: string) => {
              // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
              const templateRolls = this.subrolls[id];
              if (templateRolls == null) {
                throw new Error(`expected subroll of ${id}`);
              }
              return templateRolls.rolls.flatMap((r) => r.results).join("; ");
            },
          ),
        ];
    }
  }
}