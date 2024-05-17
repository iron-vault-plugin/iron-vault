import {
  OracleRollable,
  OracleTableRowDetails,
  OracleTableRowSimple,
} from "@datasworn/core";
import { NoSuchOracleError } from "../../../model/errors";
import {
  Oracle,
  OracleGrouping,
  OracleRollableRow,
  OracleRow,
  RollContext,
} from "../../../model/oracle";
import { Roll, RollResultKind, Subroll, sameRoll } from "../../../model/rolls";
import { Dice } from "../../../utils/dice";

function asOracleRow(
  rawRow: OracleTableRowSimple | OracleTableRowDetails,
): OracleRow {
  return Object.freeze({
    id: rawRow.id,
    result: rawRow.result,
    template: rawRow.template,
    range:
      rawRow.min != null && rawRow.max != null
        ? { min: rawRow.min, max: rawRow.max }
        : null,
  });
}

export function isRollableOracleRow(row: OracleRow): row is OracleRollableRow {
  return row.range != null;
}

export class DataswornOracle implements Oracle {
  constructor(
    protected table: OracleRollable,
    public readonly parent: OracleGrouping,
  ) {}

  get rollableRows(): OracleRollableRow[] {
    return this.table.rows.map(asOracleRow).filter(isRollableOracleRow);
  }

  row(id: string): OracleRow {
    return asOracleRow(this.internalRow(id));
  }

  protected internalRow(
    id: string,
  ): OracleTableRowSimple | OracleTableRowDetails {
    const row = this.table.rows.find((row) => row.id === id);
    if (row == null) {
      throw new Error(`[table ${this.id}] missing row ${id}`);
    }
    return row;
  }

  get name(): string {
    return this.table.name;
  }

  get id(): string {
    return this.table.id;
  }

  dice(): Dice {
    return Dice.fromDiceString(this.table.dice);
  }

  roll(context: RollContext): Roll {
    const dice = this.dice();
    return this.evaluate(context, dice.roll());
  }

  evaluate(context: RollContext, roll: number): Roll {
    const row = this.table.rows.find(
      (row) =>
        row.min != null &&
        row.min <= roll &&
        row.max != null &&
        roll <= row.max,
    );
    if (row == null) {
      throw new Error(`roll ${roll} is off the charts for ${this.table.id}`);
    }

    console.log(row);

    const subrolls: Record<string, Subroll<Roll>> = {};

    let kind: RollResultKind | undefined;

    if (row.template != null) {
      const template = row.template;
      // TODO: apparently also description and summary
      if (template.result == null) {
        throw new Error(`unhandled template for ${this.table.id}`);
      }
      kind = RollResultKind.Templated;
      for (const [, id] of template.result.matchAll(
        /\{\{result:([^{}]+)\}\}/g,
      )) {
        const prevRoll = subrolls[id];
        if (!prevRoll) {
          const subTable = context.lookup(id);
          if (subTable == null) {
            throw new NoSuchOracleError(
              id,
              `missing subtable in ${this.table.id}`,
            );
          }
          subrolls[id] = {
            rolls: [subTable.roll(context)],
            inTemplate: true,
          };
        }
      }
    }
    if (row.oracle_rolls != null) {
      for (const subOracle of row.oracle_rolls) {
        const subOracleId = subOracle.oracle ?? this.id;
        if (subOracleId in subrolls) {
          console.warn(
            "[oracles] [table: %s] already generated subrolls for %s. skipping...",
            this.id,
            subOracleId,
          );
          throw new Error("unexpected duplicate subroll");
        }
        if (!subOracle.auto) {
          console.warn(
            "[oracles] [table: %s] ignoring auto=false oracle_rolls entry %s",
            this.id,
            subOracle.oracle,
          );
          continue;
        }
        if (subOracle.oracle == null) {
          if (kind == null) {
            kind = RollResultKind.Multi;
          } else {
            console.warn(
              "[oracles] [table: %s] table has both template and self rolls",
              this.id,
              subOracleId,
            );
            throw new Error(
              `table ${this.id} has both template and self rolls`,
            );
          }
        }

        const subrollable: Oracle | undefined =
          subOracle.oracle == null ? this : context.lookup(subOracle.oracle);
        if (!subrollable)
          throw new Error(
            `missing oracle ${subOracle.oracle} referenced in ${this.id} Oracle rolls`,
          );

        const results: Roll[] = [];
        let iterations = 0;
        while (results.length < subOracle.number_of_rolls) {
          if (iterations++ >= 10) {
            console.warn(
              "[oracles] [table: %s] too many iterations for subroll %s",
              this.id,
              subOracle.oracle,
            );
            throw new Error("too many iterations");
          }
          const roll = subrollable.roll(context);
          switch (subOracle.duplicates) {
            case "reroll":
              if (
                results.find((otherRoll) => sameRoll(roll, otherRoll)) != null
              ) {
                console.log("duplicate roll skipped", results, roll);
              } else {
                results.push(roll);
              }
              break;
            case "make_it_worse":
              console.warn(
                "[oracles] [table: %s] found `make_it_worse` in subroll %s",
                this.id,
                subOracle.oracle,
              );
              results.push(roll);
              break;
            case "keep":
              results.push(roll);
              break;
            default:
              throw new Error("unexpected duplicate type");
          }
        }

        subrolls[subOracleId] = { rolls: results, inTemplate: false };
      }
    }

    return {
      kind: kind ?? RollResultKind.Simple,
      roll,
      tableId: this.id,
      rowId: row.id,
      subrolls,
    };
  }

  variants(context: RollContext, roll: Roll): Record<string, Roll> {
    const dice = this.dice();
    return {
      flip: this.evaluate(context, dice.flip(roll.roll)),
    };
  }
}
