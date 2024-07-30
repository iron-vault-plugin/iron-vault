import { StandardIndex } from "datastore/data-indexer";
import IronVaultPlugin from "index";
import { Oracle, RollContext } from "model/oracle";
import { RollWrapper } from "model/rolls";
import { Dice, DieKind } from "utils/dice";
import {
  AsyncDiceRoller,
  DiceRoller,
  GraphicalDiceRoller,
  PlainDiceRoller,
} from "utils/dice-roller";

export class OracleRoller implements RollContext {
  constructor(
    protected readonly plugin: IronVaultPlugin,
    protected readonly index: StandardIndex<Oracle>,
  ) {}

  diceRoller(): AsyncDiceRoller & DiceRoller {
    return this.plugin.settings.graphicalOracleDice
      ? new GraphicalDiceRoller(this.plugin)
      : PlainDiceRoller.INSTANCE;
  }

  lookup(id: string): Oracle | undefined {
    return this.index.get(id);
  }

  get useCursedDie(): boolean {
    return this.plugin.settings.enableCursedDie;
  }

  get cursedDieSides(): number {
    return this.plugin.settings.cursedDieSides;
  }

  cursedDice(): Dice | undefined {
    return this.useCursedDie
      ? new Dice(1, this.cursedDieSides, DieKind.Cursed)
      : undefined;
  }

  async roll(oracle: Oracle | string): Promise<RollWrapper> {
    let table: Oracle | undefined;
    if (typeof oracle === "string") {
      table = this.index.get(oracle);
      if (table == null) {
        throw new Error(`unable to find table with $id = ${oracle}`);
      }
    } else {
      table = oracle;
    }

    return new RollWrapper(table, this, await table.roll(this));
  }
}
