import { Datasworn } from "@datasworn/core";
import { parseDataswornLinks } from "datastore/parsers/datasworn/id";
import IronVaultPlugin from "index";
import { html, noChange, render } from "lit-html";
import {
  ChildPart,
  Directive,
  directive,
  DirectiveParameters,
  PartInfo,
  PartType,
} from "lit-html/directive.js";
import { map } from "lit-html/directives/map.js";
import { ref } from "lit-html/directives/ref.js";
import { NoSuchOracleError } from "model/errors";
import { CurseBehavior, Oracle, RollContext } from "model/oracle";
import { Roll, RollWrapper, Subroll } from "model/rolls";
import { Modal, Platform, setIcon, Setting, ToggleComponent } from "obsidian";
import { randomInt } from "utils/dice";

function generateOracleRows(currentRoll: RollWrapper): RollWrapper[] {
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

class RowState {
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

      if (index != subrolls.rolls.length + 1)
        throw new Error(
          `subroll requested at index ${index}, but existing subrolls length is ${subrolls.rolls.length}`,
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

class RollerState {
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
    isInitial: boolean;
    isSelected: boolean;
    index: number;
  }> {
    for (let index = 0; index < this.rows.length; index++) {
      const oracleRow = this.oracle.raw.rows[index];
      yield {
        roll: this.rows[index],
        oracleRow,
        isInitial: this.initialRowIndex == index,
        isSelected: this.selectedRowIndex == index,
        index,
      };
    }
  }
}

class ObservableRoll {
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

interface IRollContainer {
  mainResult: ObservableRoll;
  oracle: Oracle;

  isCursable(): this is CursableRollContainer;

  activeRoll(): [ObservableRoll, (state: RollerState) => boolean];
}

class SimpleRollContainer implements IRollContainer {
  mainResult: ObservableRoll;

  constructor(initialRoll: RollWrapper | RollerState) {
    this.mainResult = new ObservableRoll(initialRoll);
  }

  get oracle() {
    return this.mainResult.oracle;
  }

  isCursable(): this is CursableRollContainer {
    return false;
  }

  activeRoll(): [ObservableRoll, (state: RollerState) => boolean] {
    return [
      this.mainResult,
      (state) => {
        const oldResult = this.mainResult;
        this.mainResult = oldResult.update(state);
        return oldResult != this.mainResult;
      },
    ];
  }
}

class CursableRollContainer implements IRollContainer {
  /** Value of cursed die, if rolled. */
  cursedDie?: number;

  mainResult: ObservableRoll;
  cursedResult: ObservableRoll;
  useCursedResult: boolean;

  constructor(initialRoll: RollWrapper) {
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

  activeRoll(): [ObservableRoll, (state: RollerState) => boolean] {
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
}

function createRollContainer(roll: RollWrapper): RollContainer {
  if (roll.cursedTable) {
    return new CursableRollContainer(roll);
  } else {
    return new SimpleRollContainer(roll);
  }
}

type RollContainer = SimpleRollContainer | CursableRollContainer;

export class NewOracleRollerModal extends Modal {
  public accepted: boolean = false;

  protected tableContainerEl: HTMLDivElement;
  cursedToggle!: ToggleComponent;

  static async forRoll(
    plugin: IronVaultPlugin,
    oracle: Oracle,
    context: RollContext,
    initialRoll: Roll,
  ): Promise<{ roll: RollWrapper; cursedRoll?: RollWrapper }> {
    return new Promise((resolve, reject) => {
      try {
        new this(
          plugin,
          createRollContainer(new RollWrapper(oracle, context, initialRoll)),
          (state, cursedState) =>
            resolve({
              roll: state.currentRoll(),
              cursedRoll: cursedState && cursedState.currentRoll(),
            }),
          reject,
        ).open();
      } catch (e) {
        reject(e);
      }
    });
  }

  constructor(
    private plugin: IronVaultPlugin,
    public rollContainer: RollContainer,
    protected readonly onAccept: (
      acceptedState: ObservableRoll,
      cursedRollState?: ObservableRoll,
    ) => void,
    protected readonly onCancel: () => void,
  ) {
    super(plugin.app);

    const { contentEl } = this;
    new Setting(contentEl).setName(this.rollContainer.oracle.name).setHeading();
    this.tableContainerEl = contentEl.createDiv();

    this.scope.register([], "ArrowUp", () => {
      this.updateState((s) => s.updateSelection((n) => n - 1));
      return false;
    });
    this.scope.register([], "ArrowDown", () => {
      this.updateState((s) => s.updateSelection((n) => n + 1));
      return false;
    });
    this.scope.register([], "r", () => {
      this.updateState((s) => s.reroll());
      return false;
    });
    if (this.rollContainer.isCursable()) {
      this.scope.register([], "c", () => {
        // const cont = this.rollContainer as CursableRollContainer;
        this.cursedToggle.setValue(!this.cursedToggle.getValue());
        // cont.useCursedResult = !cont.useCursedResult;
        this.renderTable();
      });
    }
    this.scope.register([], "Enter", () => {
      this.accept();
    });
  }

  async updateState(
    fn: (state: RollerState) => RollerState | Promise<RollerState>,
  ) {
    const [current, updater] = this.rollContainer.activeRoll();
    const state = await Promise.resolve(fn(current.observe()));
    if (updater(state)) this.renderTable();
  }

  renderTable() {
    // TODO(@cwegrzyn): need to render markdown

    console.debug(this);

    const renderCurseToggle = (rollContainer: CursableRollContainer) => {
      const cursedTable = rollContainer.cursedResult.oracle;
      const name =
        cursedTable.curseBehavior === CurseBehavior.AddResult
          ? "Add a cursed result"
          : "Replace with cursed result";
      const dieResult =
        rollContainer.cursedDie != null
          ? `You rolled a ${rollContainer.cursedDie} on the cursed die.`
          : "";
      // const desc =
      //   cursedTable.curseBehavior === CurseBehavior.AddResult
      //     ? "The cursed table's result will be added to the regular oracle roll"
      //     : "The cursed table's result will replace the regular oracle roll";
      return html`<div>
        <div class="setting-item mod-toggle">
          <div class="setting-item-info">
            <div class="setting-item-name">${name}</div>
            <div class="setting-item-description">${dieResult}</div>
          </div>
          <div class="setting-item-control">
            ${toggleDirective((el) => {
              return (this.cursedToggle = new ToggleComponent(el)
                .setValue(rollContainer.useCursedResult)
                .onChange((val) => {
                  rollContainer.useCursedResult = val;
                  this.renderTable();
                }));
            })}
          </div>
        </div>
      </div>`;
    };

    const activeContainer = this.rollContainer.isCursable()
      ? this.rollContainer.useCursedResult
        ? this.rollContainer.cursedResult
        : this.rollContainer.mainResult
      : this.rollContainer.mainResult;

    const activeState = activeContainer.observe();
    const oracleDesc = activeState.oracle.raw;
    const columns = oracleColumnDescs(oracleDesc);

    render(
      html`
        ${this.rollContainer.isCursable()
          ? renderCurseToggle(this.rollContainer)
          : undefined}
        <div class="iron-vault-oracle-table-container">
          <table class="iron-vault-oracle-table">
            <thead>
              <tr>
                ${map(columns, ({ label }) => html`<th>${label}</th>`)}
                <th />
              </tr>
            </thead>
            <tbody>
              ${map(
                activeState.rowsIter(),
                ({
                  roll: rowState,
                  oracleRow: row,
                  index: i,
                  isInitial: initial,
                  isSelected: selected,
                }) => {
                  const renderedSubrolls = new Set();
                  const rolled = rowState.currentRoll();
                  const renderSubRolls = (text: string) => {
                    return map(parseDataswornLinks(text), (value) => {
                      if (typeof value == "string") {
                        return value;
                      }

                      const { id, label } = value;
                      renderedSubrolls.add(id);
                      const subrolls = rolled.subrolls[id];
                      if (subrolls) {
                        return map(
                          subrolls.rolls,
                          (subroll, subidx) =>
                            html`<a
                              aria-label=${subroll.oracle.name}
                              data-tooltip-position="top"
                              @click=${(ev: MouseEvent) =>
                                this._subrollClick(ev, i, id, subidx)}
                              >${subroll.ownResult}</a
                            >`,
                        );
                      } else {
                        // TODO(@cwegrzyn): Make it so that you can subroll these? Why was it not rolled? Not auto?
                        return html`<a>${label}</a>`;
                      }
                    });
                  };
                  return html`<tr
                    @click=${async (_ev: MouseEvent) => {
                      await this.updateState((s) => s.updateSelection(() => i));
                      if (Platform.isMobile) {
                        this.accept();
                      }
                    }}
                    ${selected
                      ? ref(
                          (el) =>
                            el &&
                            setTimeout(() => {
                              el.scrollIntoView({
                                behavior: "smooth",
                                block: "center",
                              });
                            }, 10),
                        )
                      : null}
                    class=${selected ? "selected" : null}
                  >
                    ${map(
                      columns,
                      ({ getter }) =>
                        html`<td>${renderSubRolls(getter(row))}</td>`,
                    )}
                    ${initial
                      ? html`<td
                          aria-label="Initial roll"
                          data-tooltip-position="top"
                          ${ref(
                            (el) =>
                              el &&
                              el instanceof HTMLElement &&
                              setIcon(el, "bookmark"),
                          )}
                        />`
                      : html`<td />`}
                  </tr>`;
                },
              )}
            </tbody>
          </table>
        </div>
        <div class="prompt-instructions">
          <div class="prompt-instruction">
            <span class="prompt-instruction-command">↑↓</span>
            <span>to navigate</span>
          </div>
          <div class="prompt-instruction">
            <span class="prompt-instruction-command">⏎</span>
            <span>to accept</span>
          </div>
          <div class="prompt-instruction">
            <span class="prompt-instruction-command">r</span>
            <span>to reroll</span>
          </div>
          ${this.rollContainer.isCursable()
            ? html`<div class="prompt-instruction">
                <span class="prompt-instruction-command">c</span>
                <span>to toggle curse</span>
              </div>`
            : undefined}
          <div class="prompt-instruction">
            <span class="prompt-instruction-command">esc</span>
            <span>to dismiss</span>
          </div>
        </div>
      `,
      this.tableContainerEl,
    );
  }

  private _subrollClick(
    ev: MouseEvent,
    rowIndex: number,
    id: string,
    subidx: number,
  ) {
    ev.preventDefault();
    ev.stopPropagation();

    const [state, updateContainer] = this.rollContainer.activeRoll();
    const [row, updateRoller] = state.observe().rowForUpdate(rowIndex);
    const [subrollRoller, updateRow] = row.observeSubroll(id, subidx);

    new NewOracleRollerModal(
      this.plugin,
      new SimpleRollContainer(subrollRoller),
      (newSubrollState) => {
        const newRollerState = updateRoller(
          updateRow(newSubrollState.observe()),
        ).updateSelection(() => rowIndex);
        if (updateContainer(newRollerState)) {
          this.renderTable();
        }
      },
      () => {},
    ).open();
  }

  onOpen(): void {
    this.accepted = false;

    this.renderTable();
  }

  accept(): void {
    this.accepted = true;
    this.close();
    this.onAccept(
      this.rollContainer.mainResult,
      this.rollContainer.isCursable() && this.rollContainer.useCursedResult
        ? this.rollContainer.cursedResult
        : undefined,
    );
  }

  onClose(): void {
    const { contentEl } = this;
    contentEl.empty();
    if (!this.accepted) {
      this.onCancel();
    }
  }
}

function oracleColumnDescs(
  oracleDesc: Datasworn.OracleRollable | Datasworn.EmbeddedOracleRollable,
) {
  const columns: {
    label: string;
    getter: (
      row:
        | Datasworn.OracleRollableRowText
        | Datasworn.OracleRollableRowText2
        | Datasworn.OracleRollableRowText3,
    ) => string;
  }[] = [];
  const rollGetter = (row: Datasworn.OracleRollableRowText) => {
    if (!row.roll) {
      return "";
    } else if (row.roll.min === row.roll.max) {
      return "" + row.roll.min;
    } else {
      return `${row.roll.min} - ${row.roll.max}`;
    }
  };
  switch (oracleDesc.oracle_type) {
    case "table_text3":
      columns.unshift({
        label: oracleDesc.column_labels.text3,
        getter: (row) => (row as Datasworn.OracleRollableRowText3).text3 ?? "",
      });
    // eslint-disable-next-line no-fallthrough
    case "table_text2":
      columns.unshift({
        label: oracleDesc.column_labels.text2,
        getter: (row) => (row as Datasworn.OracleRollableRowText2).text2 ?? "",
      });
    // eslint-disable-next-line no-fallthrough
    case "table_text":
      columns.unshift(
        { label: oracleDesc.column_labels.roll, getter: rollGetter },
        {
          label: oracleDesc.column_labels.text,
          getter: (row) => row.text ?? "",
        },
      );
      break;

    case "column_text3":
      columns.unshift({
        label: "Text 3",
        getter: (row) => (row as Datasworn.OracleRollableRowText3).text3 ?? "",
      });
    // eslint-disable-next-line no-fallthrough
    case "column_text2":
      columns.unshift({
        label: "Text 2",
        getter: (row) => (row as Datasworn.OracleRollableRowText2).text2 ?? "",
      });
    // eslint-disable-next-line no-fallthrough
    case "column_text":
      columns.unshift(
        { label: "Roll", getter: rollGetter },
        { label: "Text", getter: (row) => row.text ?? "" },
      );
      break;
  }
  return columns;
}

class ToggleComponentDirective extends Directive {
  _component: ToggleComponent | null = null;

  constructor(partInfo: PartInfo) {
    super(partInfo);
    if (partInfo.type !== PartType.CHILD) {
      throw new Error("Noooope");
    }
    console.log("Creating toggle component...");
  }

  update(part: ChildPart, [componentFn]: DirectiveParameters<this>): unknown {
    if (this._component == null) {
      console.debug("Need a new inner object");

      const tempEl = document.createElement("div");
      this._component = componentFn(tempEl);
      if (tempEl.children.length != 1)
        throw new Error("unexpected number of child elements");
      return tempEl.children[0];
    }
    return noChange;
  }

  render(_componentFn: (parentEl: HTMLElement) => ToggleComponent): unknown {
    return noChange;
  }
}

const toggleDirective = directive(ToggleComponentDirective);
