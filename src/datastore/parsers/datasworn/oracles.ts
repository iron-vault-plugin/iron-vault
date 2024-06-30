import { type Datasworn } from "@datasworn/core";
import IronVaultPlugin from "index";
import { rootLogger } from "logger";
import { NoSuchOracleError } from "../../../model/errors";
import {
  CurseBehavior,
  Oracle,
  OracleGrouping,
  OracleRollableRow,
  OracleRow,
  RollContext,
} from "../../../model/oracle";
import { Roll, RollResultKind, Subroll, sameRoll } from "../../../model/rolls";
import { Dice, DieKind } from "../../../utils/dice";
import { DiceGroup } from "utils/dice-group";

const logger = rootLogger.getLogger("datasworn/oracles");

function asOracleRow(rawRow: Datasworn.OracleRollableRow): OracleRow {
  return Object.freeze({
    result: rawRow.text,
    template: rawRow.template,
    range: rawRow.roll,
  });
}

export function isRollableOracleRow(row: OracleRow): row is OracleRollableRow {
  return row.range != null;
}

export class DataswornOracle implements Oracle {
  constructor(
    protected readonly table:
      | Datasworn.OracleRollable
      | Datasworn.EmbeddedOracleRollable,
    public readonly parent: OracleGrouping,
    private readonly plugin?: IronVaultPlugin,
  ) {}

  get raw(): Datasworn.OracleRollable | Datasworn.EmbeddedOracleRollable {
    return this.table;
  }

  get rollableRows(): OracleRollableRow[] {
    return this.table.rows.map(asOracleRow).filter(isRollableOracleRow);
  }

  row(value: number): OracleRow {
    return asOracleRow(this.rowFor(value));
  }

  protected rowFor(roll: number): Datasworn.OracleRollableRow {
    const row = this.table.rows.find(
      (row) => row.roll != null && row.roll.min <= roll && roll <= row.roll.max,
    );
    if (row == null) {
      throw new Error(`roll ${roll} is off the charts for ${this.id}`);
    }
    return row;
  }

  get name(): string {
    return this.table.name;
  }

  get id(): string {
    return this.table._id;
  }

  get dice(): Dice {
    return Dice.fromDiceString(this.table.dice, this.plugin, DieKind.Oracle);
  }

  get cursedBy(): Oracle | undefined {
    for (const val of Object.values(this.table.tags ?? {})) {
      if (typeof val.cursed_by === "string") {
        return this.plugin?.datastore.oracles.get(val.cursed_by);
      }
    }
    return;
  }

  get curseBehavior(): CurseBehavior | undefined {
    for (const val of Object.values(this.table.tags ?? {})) {
      if (typeof val.curse_behavior === "string") {
        return val.curse_behavior as CurseBehavior;
      }
    }
    return;
  }

  async roll(context: RollContext): Promise<Roll> {
    const cursed = this.cursedBy;
    if (cursed && this.plugin && this.plugin.settings.enableCursedDie) {
      const group = new DiceGroup(
        [
          this.dice,
          new Dice(
            1,
            this.plugin.settings.cursedDieSides,
            this.plugin,
            DieKind.Cursed,
          ),
        ],
        this.plugin,
      );
      const res = await group.roll();
      return this.evaluate(context, res[0].value, res[1].value, cursed.id);
    }
    return this.evaluate(context, await this.dice.roll());
  }

  async evaluate(
    context: RollContext,
    roll: number,
    cursedRoll?: number,
    cursedTableId?: string,
  ): Promise<Roll> {
    const row = this.rowFor(roll);

    const subrolls: Record<string, Subroll<Roll>> = {};

    let kind: RollResultKind | undefined;

    if (row.template != null) {
      const template = row.template;
      // TODO: apparently also description and summary
      if (template.text == null) {
        throw new Error(`unhandled template for ${this.id}`);
      }
      kind = RollResultKind.Templated;
      for (const [, id] of template.text.matchAll(/\{\{text>([^{}]+)\}\}/g)) {
        const prevRoll = subrolls[id];
        if (!prevRoll) {
          const subTable = context.lookup(id);
          if (subTable == null) {
            throw new NoSuchOracleError(id, `missing subtable in ${this.id}`);
          }
          subrolls[id] = {
            rolls: [await subTable.roll(context)],
            inTemplate: true,
          };
        }
      }
    }
    if (row.oracle_rolls != null) {
      for (const subOracle of row.oracle_rolls) {
        const subOracleId = subOracle.oracle ?? this.id;
        if (subOracleId in subrolls) {
          logger.warn(
            "[table: %s] already generated subrolls for %s. skipping...",
            this.id,
            subOracleId,
          );
          throw new Error("unexpected duplicate subroll");
        }
        if (!subOracle.auto) {
          logger.warn(
            "[table: %s] ignoring auto=false oracle_rolls entry %s",
            this.id,
            subOracle.oracle,
          );
          continue;
        }
        if (subOracle.oracle == null) {
          if (kind == null) {
            kind = RollResultKind.Multi;
          } else {
            logger.warn(
              "[table: %s] table has both template and self rolls",
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
            logger.warn(
              "[table: %s] too many iterations for subroll %s",
              this.id,
              subOracle.oracle,
            );
            throw new Error("too many iterations");
          }
          const roll = await subrollable.roll(context);
          switch (subOracle.duplicates) {
            case "reroll":
              if (
                results.find((otherRoll) => sameRoll(roll, otherRoll)) != null
              ) {
                logger.warn("duplicate roll skipped", results, roll);
              } else {
                results.push(roll);
              }
              break;
            case "make_it_worse":
              logger.warn(
                "[table: %s] found `make_it_worse` in subroll %s",
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
      subrolls,
      cursedRoll,
      cursedTableId,
    };
  }

  async variants(
    context: RollContext,
    roll: Roll,
  ): Promise<Record<string, Roll>> {
    return {
      flip: await this.evaluate(context, this.dice.flip(roll.roll)),
    };
  }
}
