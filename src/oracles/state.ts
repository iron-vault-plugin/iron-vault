/**
 * Classes that allow us to track the state of user oracle result selection.
 */
import { Datasworn } from "@datasworn/core";
import { NoSuchOracleError } from "model/errors";
import { CurseBehavior, Oracle, RollContext } from "model/oracle";
import { RollWrapper, Subroll, withinRange } from "model/rolls";
import { randomInt } from "utils/dice";

export class RollerState {
  static fromRoll(initialRoll: RollWrapper): RollerState {
    const rows = generateOracleRows(initialRoll).map((roll) =>
      RowState.fromRoll(roll),
    );
    const currentRowIndex = rows.findIndex(
      (row) => row.initialRoll == initialRoll,
    );
    return new this(
      initialRoll.oracle,
      initialRoll.context,
      rows,
      currentRowIndex,
      currentRowIndex,
    );
  }

  private constructor(
    public oracle: Oracle,
    public context: RollContext,
    public rows: RowState[],
    public selectedRowIndex: number,
    public initialRowIndex: number,
  ) {}

  rowForUpdate(index: number): [RowState, (state: RowState) => RollerState] {
    return [
      this.rows[index],
      (newRowState) => {
        if (newRowState !== this.rows[index]) {
          const rows = [...this.rows];
          rows[index] = newRowState;
          return new RollerState(
            this.oracle,
            this.context,
            rows,
            this.selectedRowIndex,
            this.initialRowIndex,
          );
        }
        return this;
      },
    ];
  }

  updateSelection(updater: (oldRow: number) => number): RollerState {
    const newIndex = updater(this.selectedRowIndex) % this.rows.length;
    return new RollerState(
      this.oracle,
      this.context,
      this.rows,
      newIndex < 0 ? newIndex + this.rows.length : newIndex,
      this.initialRowIndex,
    );
  }

  currentRoll(): RollWrapper {
    return this.rows[this.selectedRowIndex].currentRoll();
  }

  async reroll(): Promise<RollerState> {
    const newRoll = await this.currentRoll().reroll();
    return RollerState.fromRoll(newRoll);
  }

  *rowsIter(): Iterable<{
    roll: RowState;
    oracleRow:
      | Datasworn.OracleRollableRowText
      | Datasworn.OracleRollableRowText2
      | Datasworn.OracleRollableRowText3;
    marker: "initial" | "flipped" | null;
    isSelected: boolean;
    index: number;
  }> {
    const flippedRoll = this.oracle.dice.flip(
      this.rows[this.initialRowIndex].initialRoll.diceValue,
    );
    for (let index = 0; index < this.rows.length; index++) {
      const oracleRow = this.oracle.raw.rows[index];
      const roll = this.rows[index];
      yield {
        roll,
        oracleRow,
        marker:
          this.initialRowIndex == index
            ? "initial"
            : withinRange(flippedRoll, oracleRow.roll ?? undefined)
              ? "flipped"
              : null,
        isSelected: this.selectedRowIndex == index,
        index,
      };
    }
  }
}
export class ObservableRoll {
  #value: RollWrapper | RollerState;

  constructor(initialRoll: RollWrapper | RollerState) {
    this.#value = initialRoll;
  }

  currentRoll(): RollWrapper {
    return this.#value instanceof RollWrapper
      ? this.#value
      : this.#value.currentRoll();
  }

  observe(): RollerState {
    return this.#value instanceof RollWrapper
      ? (this.#value = RollerState.fromRoll(this.#value))
      : this.#value;
  }

  get oracle(): Oracle {
    return this.#value.oracle;
  }

  update(newState: RollerState): ObservableRoll {
    if (newState != this.#value) {
      return new ObservableRoll(newState);
    } else {
      return this;
    }
  }
}
export function generateOracleRows(currentRoll: RollWrapper): RollWrapper[] {
  const { oracle, context } = currentRoll;
  return oracle.rollableRows.map((row) => {
    if (
      row.range.min <= currentRoll.diceValue &&
      currentRoll.diceValue <= row.range.max
    ) {
      return currentRoll;
    } else {
      // TODO(@cwegrzyn): this distribution is wrong-- assumes an even value between the two points, but that's not correct
      return new RollWrapper(
        oracle,
        context,
        oracle.evaluate(context, randomInt(row.range.min, row.range.max)),
      );
    }
  });
}

export class RowState {
  #subrollStates: Map<string, Subroll<ObservableRoll>>;
  #initialRoll: RollWrapper;

  static fromRoll(initialRoll: RollWrapper): RowState {
    return new this(
      initialRoll,
      new Map(
        Object.entries(initialRoll.subrolls ?? {}).map(([id, subrolls]) => [
          id,
          {
            ...subrolls,
            rolls: subrolls.rolls.map((r) => new ObservableRoll(r)),
          },
        ]),
      ),
    );
  }

  private constructor(
    initialRoll: RollWrapper,
    subrollStates: Map<string, Subroll<ObservableRoll>>,
  ) {
    this.#initialRoll = initialRoll;
    this.#subrollStates = subrollStates;
  }

  get initialRoll(): RollWrapper {
    return this.#initialRoll;
  }

  observeSubroll(
    id: string,
    index: number,
  ): [RollerState, (roll: RollerState) => RowState] {
    let subrolls = this.#subrollStates.get(id);
    if (subrolls == null) {
      subrolls = { inTemplate: false, rolls: [] };
      this.#subrollStates.set(id, subrolls);
    }

    let subroll = subrolls.rolls.at(index);
    if (!subroll) {
      const { context } = this.#initialRoll;
      const oracle = context.lookup(id);
      if (!oracle) throw new NoSuchOracleError(id);

      if (index != subrolls.rolls.length)
        throw new Error(
          `subroll requested at index ${index}, but expected to match existing subrolls length of ${subrolls.rolls.length}`,
        );
      subroll = new ObservableRoll(
        new RollWrapper(oracle, context, oracle.rollDirect(context)),
      );
      subrolls.rolls.push(subroll);
    }
    return [subroll.observe(), (roll) => this.#updatingRoll(id, index, roll)];
  }

  #updatingRoll(id: string, index: number, subroll: RollerState): RowState {
    const newSubrollStates = new Map(this.#subrollStates);
    let subrolls = newSubrollStates.get(id);
    if (subrolls == null) {
      subrolls = { inTemplate: false, rolls: [] };
    } else {
      subrolls = { ...subrolls, rolls: [...subrolls.rolls] };
    }
    newSubrollStates.set(id, subrolls);
    subrolls.rolls[index] = new ObservableRoll(subroll);

    return new RowState(this.#initialRoll, newSubrollStates);
  }

  currentRoll(): RollWrapper {
    if (!this.#initialRoll.subrolls || this.#subrollStates.size == 0) {
      // If there were no subrolls, this is simple.
      return this.#initialRoll;
    }
    return this.#initialRoll.replacingSubrolls(
      [...this.#subrollStates.entries()].map(([key, subroll]) => [
        key,
        {
          ...subroll,
          rolls: subroll.rolls.map((roll) => roll.currentRoll()),
        },
      ]),
    );
  }
}

export interface IRollContainer {
  mainResult: ObservableRoll;
  oracle: Oracle;

  isCursable(): this is CursableRollContainer;

  activeRoll(): ObservableRoll;
  activeRollWrapper(): RollWrapper;
  activeRollForUpdate(): [ObservableRoll, (state: RollerState) => boolean];

  copy(): IRollContainer;
}

export class SimpleRollContainer implements IRollContainer {
  mainResult: ObservableRoll;

  constructor(initialRoll: RollWrapper | RollerState | SimpleRollContainer) {
    if (initialRoll instanceof SimpleRollContainer) {
      this.mainResult = initialRoll.mainResult;
    } else {
      this.mainResult = new ObservableRoll(initialRoll);
    }
  }

  get oracle() {
    return this.mainResult.oracle;
  }

  isCursable(): this is CursableRollContainer {
    return false;
  }

  activeRoll() {
    return this.mainResult;
  }

  activeRollWrapper() {
    return this.activeRoll().currentRoll();
  }

  activeRollForUpdate(): [ObservableRoll, (state: RollerState) => boolean] {
    return [
      this.mainResult,
      (state) => {
        const oldResult = this.mainResult;
        this.mainResult = oldResult.update(state);
        return oldResult != this.mainResult;
      },
    ];
  }

  copy() {
    return new SimpleRollContainer(this);
  }
}

export class CursableRollContainer implements IRollContainer {
  /** Value of cursed die, if rolled. */
  cursedDie?: number;

  mainResult: ObservableRoll;
  cursedResult: ObservableRoll;
  useCursedResult: boolean;

  constructor(initialRoll: RollWrapper | CursableRollContainer) {
    if (initialRoll instanceof CursableRollContainer) {
      this.cursedDie = initialRoll.cursedDie;
      this.mainResult = initialRoll.mainResult;
      this.cursedResult = initialRoll.cursedResult;
      this.useCursedResult = initialRoll.useCursedResult;
      return;
    }
    if (!initialRoll.cursedTable) {
      throw new Error("must have a cursed table");
    }
    this.cursedDie = initialRoll.cursedRoll;
    this.useCursedResult = initialRoll.cursedRoll == 10;
    this.mainResult = new ObservableRoll(initialRoll);

    const cursedTable = initialRoll.cursedTable;
    this.cursedResult = new ObservableRoll(
      new RollWrapper(
        cursedTable,
        initialRoll.context,
        cursedTable.curseBehavior == CurseBehavior.ReplaceResult
          ? cursedTable.evaluate(initialRoll.context, initialRoll.roll.roll)
          : cursedTable.rollDirect(initialRoll.context),
      ),
    );
  }

  get oracle() {
    return this.mainResult.oracle;
  }

  isCursable(): this is CursableRollContainer {
    return true;
  }

  activeRoll() {
    return this.useCursedResult ? this.cursedResult : this.mainResult;
  }

  activeRollForUpdate(): [ObservableRoll, (state: RollerState) => boolean] {
    return [
      this.useCursedResult ? this.cursedResult : this.mainResult,
      (state) => {
        if (this.useCursedResult) {
          const oldResult = this.cursedResult;
          this.cursedResult = oldResult.update(state);
          return oldResult != this.cursedResult;
        } else {
          const oldResult = this.mainResult;
          this.mainResult = oldResult.update(state);
          return oldResult != this.mainResult;
        }
      },
    ];
  }

  copy() {
    return new CursableRollContainer(this);
  }

  activeRollWrapper() {
    return this.activeRoll().currentRoll();
  }
}

export function createRollContainer(roll: RollWrapper): RollContainer {
  if (roll.cursedTable) {
    return new CursableRollContainer(roll);
  } else {
    return new SimpleRollContainer(roll);
  }
}

export type RollContainer = SimpleRollContainer | CursableRollContainer;
