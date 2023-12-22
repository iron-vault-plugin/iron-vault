import { OracleRollable } from "@datasworn/core";
import { Oracle, OracleRow, RollContext } from "../../../model/oracle";
import { Roll, sameRoll } from "../../../model/rolls";
import { Dice } from "../../../utils/dice";

export class DataswornOracle implements Oracle {
  constructor(
    protected table: OracleRollable,
    public readonly parentId: string,
    public readonly category: string,
    protected namePrefix?: string,
  ) {}
  row(id: string): OracleRow | undefined {
    const rawRow = this.table.rows.find((row) => row.id === id);
    return rawRow
      ? Object.freeze({ id, result: rawRow.result, template: rawRow.template })
      : undefined;
  }
  get name(): string {
    return this.namePrefix
      ? `${this.namePrefix}: ${this.table.name}`
      : this.table.name;
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
    if (row.template != null) {
      if (row.oracle_rolls != null) {
        console.warn(
          "Oracle %s row %s has both 'template' and 'oracle_rolls'",
          this.table.id,
          row.id,
        );
      }
      const template = row.template;
      // TODO: apparently also description and summary
      if (template.result == null) {
        throw new Error(`unhandled template for ${this.table.id}`);
      }
      const templateRolls = new Map<string, Roll>();
      for (const [, id] of template.result.matchAll(/\{\{([^{}]+)\}\}/g)) {
        const subTable = context.lookup(id);
        if (subTable == null) {
          throw new Error(`missing subtable ${id} in ${this.table.id}`);
        }
        const subResult = subTable.roll(context);
        templateRolls.set(id, subResult);
      }

      return {
        kind: "templated",
        templateRolls,
        roll,
        tableId: this.id,
        rowId: row.id,
      };
    }
    if (row.oracle_rolls != null) {
      const subrolls = row.oracle_rolls.flatMap((subOracle) => {
        if (!subOracle.auto) {
          console.warn(
            "[oracles] [table: %s] oracle_rolls contains non-auto entry %s",
            this.id,
            subOracle.oracle,
          );
        }
        let subrollable: Oracle | undefined =
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
              }
              break;
            case "make_it_worse":
              console.warn(
                "[oracles] [table: %s] found `make_it_worse` in subroll %s",
                this.id,
                subOracle.oracle,
              );
            case "keep":
              results.push(roll);
            default:
              throw new Error("unexpected duplicate type");
          }
        }

        return results;
      });

      return {
        kind: "multi",
        results: subrolls,
        roll,
        tableId: this.id,
        rowId: row.id,
      };
    }
    return {
      kind: "simple",
      roll,
      tableId: this.id,
      rowId: row.id,
    };
  }

  variants(context: RollContext, roll: Roll): Record<string, Roll> {
    const dice = this.dice();
    return {
      flip: this.evaluate(context, dice.maxRoll() - roll.roll),
    };
  }
}
