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
import { join } from "lit-html/directives/join.js";
import { map } from "lit-html/directives/map.js";
import { ref } from "lit-html/directives/ref.js";
import { CurseBehavior, Oracle, RollContext } from "model/oracle";
import { Roll, RollWrapper } from "model/rolls";
import { Modal, Platform, setIcon, ToggleComponent } from "obsidian";
import {
  createRollContainer,
  CursableRollContainer,
  RollContainer,
  RollerState,
  SimpleRollContainer,
} from "./state";

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
          (container) =>
            resolve({
              roll: container.mainResult.currentRoll(),
              cursedRoll:
                container.isCursable() && container.useCursedResult
                  ? container.cursedResult.currentRoll()
                  : undefined,
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
    protected readonly onAccept: (rollContainer: RollContainer) => void,
    protected readonly onCancel: () => void,
    public titlePrefix: string[] = [],
  ) {
    super(plugin.app);

    this.rollContainer = rollContainer = rollContainer.copy();

    const { contentEl } = this;
    this.setTitle([...titlePrefix, this.rollContainer.oracle.name].join(" > "));
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
    const [current, updater] = this.rollContainer.activeRollForUpdate();
    const state = await Promise.resolve(fn(current.observe()));
    if (updater(state)) this.renderTable();
  }

  renderTable() {
    // TODO(@cwegrzyn): need to render markdown

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
                  marker,
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
                        const subOracle = rolled.context.lookup(id);
                        return html`<a
                          aria-label=${subOracle?.name}
                          data-tooltip-position="top"
                          @click=${(ev: MouseEvent) =>
                            this._subrollClick(ev, i, id, 0)}
                          >${label}</a
                        >`;
                      }
                    });
                  };
                  const renderSelfRolls = () => {
                    const selfRolls =
                      rolled.subrolls[rolled.oracle.id]?.rolls ?? [];
                    if (selfRolls.length == 0) return undefined;
                    return html` (${join(
                      map(
                        selfRolls,
                        (roll, subidx) =>
                          html`<a
                            aria-label=${rolled.oracle.name}
                            data-tooltip-position="top"
                            @click=${(ev: MouseEvent) =>
                              this._subrollClick(
                                ev,
                                i,
                                rolled.oracle.id,
                                subidx,
                              )}
                            >${roll.ownResult}</a
                          >`,
                      ),
                      html`<span class="separator">, </span>`,
                    )})`;
                  };
                  return html`<tr
                    @click=${async (_ev: MouseEvent) => {
                      await this.updateState((s) => s.updateSelection(() => i));
                      if (Platform.isMobile) {
                        this.accept();
                      }
                    }}
                    @dblclick=${async (_ev: MouseEvent) => {
                      await this.updateState((s) => s.updateSelection(() => i));
                      this.accept();
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
                      ({ getter }, index) =>
                        html`<td>
                          ${renderSubRolls(getter(row))}${index == 1
                            ? renderSelfRolls()
                            : undefined}
                        </td>`,
                    )}
                    ${renderMarker(marker, rolled.diceValue)}
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

    const [state, updateContainer] = this.rollContainer.activeRollForUpdate();
    const [row, updateRoller] = state.observe().rowForUpdate(rowIndex);
    const [subrollRoller, updateRow] = row.observeSubroll(id, subidx);

    new NewOracleRollerModal(
      this.plugin,
      new SimpleRollContainer(subrollRoller),
      (container) => {
        const newRollerState = updateRoller(
          updateRow(container.mainResult.observe()),
        ).updateSelection(() => rowIndex);
        if (updateContainer(newRollerState)) {
          this.renderTable();
        }
      },
      () => {},
      [...this.titlePrefix, state.oracle.name],
    ).open();
  }

  onOpen(): void {
    this.accepted = false;

    this.renderTable();
  }

  accept(): void {
    this.accepted = true;
    this.close();
    this.onAccept(this.rollContainer);
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

function renderMarker(marker: "initial" | "flipped" | null, diceValue: number) {
  switch (marker) {
    case "initial":
      return html`<td
        aria-label="Initial roll (${diceValue})"
        data-tooltip-position="top"
        ${ref(
          (el) => el && el instanceof HTMLElement && setIcon(el, "bookmark"),
        )}
      />`;
    case "flipped":
      return html`<td
        aria-label="Flipped roll (${diceValue})"
        data-tooltip-position="top"
        ${ref(
          (el) =>
            el && el instanceof HTMLElement && setIcon(el, "flip-vertical-2"),
        )}
      />`;
    default:
      return html`<td />`;
  }
}
