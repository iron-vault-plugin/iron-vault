import { Datasworn } from "@datasworn/core";
import { parseDataswornLinks } from "datastore/parsers/datasworn/id";
import IronVaultPlugin from "index";
import { html, noChange, nothing, render } from "lit-html";
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

export type OracleModalOptions = {
  // Label for the action taken when holding shift and accepting
  // Blank/undefined means no special action available
  shiftActionLabel?: string;
};

// Swipe state for tracking touch/mouse interactions
interface SwipeState {
  startX: number;
  startY: number;
  currentX: number;
  isDragging: boolean;
  element: HTMLElement;
  actionElement?: HTMLElement;
}

// Extended HTMLElement type for swipe handlers
type SwipeEnabledElement = HTMLElement & { __swipeHandler?: EventListener };

export class NewOracleRollerModal extends Modal {
  public accepted: boolean = false;

  protected tableContainerEl: HTMLDivElement;
  cursedToggle!: ToggleComponent;
  private swipeStates = new Map<number, SwipeState>();

  static async forRoll(
    plugin: IronVaultPlugin,
    oracle: Oracle,
    context: RollContext,
    initialRoll: Roll,
    options?: OracleModalOptions,
  ): Promise<{
    roll: RollWrapper;
    cursedRoll?: RollWrapper;
    modifiers: { shift: boolean };
  }> {
    return new Promise((resolve, reject) => {
      try {
        new this(
          plugin,
          createRollContainer(new RollWrapper(oracle, context, initialRoll)),
          (container, modifiers) =>
            resolve({
              roll: container.mainResult.currentRoll(),
              cursedRoll:
                container.isCursable() && container.useCursedResult
                  ? container.cursedResult.currentRoll()
                  : undefined,
              modifiers,
            }),
          reject,
          undefined,
          options,
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
      rollContainer: RollContainer,
      modifiers: { shift: boolean },
    ) => void,
    protected readonly onCancel: () => void,
    public titlePrefix: string[] = [],
    readonly options: OracleModalOptions = {},
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
        return false;
      });
    }
    this.scope.register([], "Enter", () => {
      this.accept({ shift: false });
      return false;
    });

    if (options.shiftActionLabel) {
      this.scope.register(["Shift"], "Enter", () => {
        this.accept({ shift: true });
        return false;
      });
    }
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
        <div class="setting-item">
          <div class="setting-item-info">
            <div class="setting-item-name"></div>
            <div class="setting-item-description">
              You rolled
              ${activeState.rows[activeState.initialRowIndex].currentRoll()
                .diceValue}.
            </div>
          </div>
          <div class="setting-item-control">
            <div class="setting-item-control">
              <div
                class="clickable-icon extra-setting-button"
                aria-label="Reroll"
                data-tooltip-position="top"
                @click=${(_ev: MouseEvent) =>
                  this.updateState((s) => s.reroll())}
                ${ref(
                  (el) =>
                    el &&
                    el instanceof HTMLElement &&
                    setIcon(el, "refresh-cw"),
                )}
              ></div>
            </div>
          </div>
        </div>
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
                        if (subOracle) {
                          return html`<a
                            aria-label=${subOracle?.name}
                            data-tooltip-position="top"
                            @click=${(ev: MouseEvent) =>
                              this._subrollClick(ev, i, id, 0)}
                            >${label}</a
                          >`;
                        } else {
                          return html`<span
                            aria-label=${id}
                            data-tooltip-position="top"
                            >${label}</span
                          >`;
                        }
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
                    @click=${async (ev: MouseEvent) => {
                      await this.updateState((s) => s.updateSelection(() => i));
                      if (Platform.isMobile) {
                        this.accept({ shift: ev.shiftKey });
                      }
                    }}
                    @dblclick=${async (ev: MouseEvent) => {
                      await this.updateState((s) => s.updateSelection(() => i));
                      this.accept({ shift: ev.shiftKey });
                    }}
                    ${ref((el) => {
                      if (el && Platform.isMobile) {
                        const swipeElement = el as SwipeEnabledElement;

                        // Remove any existing listeners first
                        const existingHandler = swipeElement.__swipeHandler;
                        if (existingHandler) {
                          el.removeEventListener("touchstart", existingHandler);
                        }

                        // Add new touchstart handler with passive: false
                        const touchStartHandler: EventListener = (
                          ev: Event,
                        ) => {
                          const touchEvent = ev as TouchEvent;
                          const handlers = this.createSwipeHandlers(i);
                          handlers.handleStart(touchEvent);

                          // Attach move and end handlers to document for better tracking
                          const handleMoveGlobal = (e: TouchEvent) =>
                            handlers.handleMove(e);
                          const handleEndGlobal = (_e: TouchEvent) => {
                            handlers.handleEnd();
                            document.removeEventListener(
                              "touchmove",
                              handleMoveGlobal,
                            );
                            document.removeEventListener(
                              "touchend",
                              handleEndGlobal,
                            );
                            document.removeEventListener(
                              "touchcancel",
                              handleEndGlobal,
                            );
                          };

                          document.addEventListener(
                            "touchmove",
                            handleMoveGlobal,
                            {
                              passive: false,
                            },
                          );
                          document.addEventListener(
                            "touchend",
                            handleEndGlobal,
                          );
                          document.addEventListener(
                            "touchcancel",
                            handleEndGlobal,
                          );
                        };

                        el.addEventListener("touchstart", touchStartHandler, {
                          passive: false,
                        });
                        swipeElement.__swipeHandler = touchStartHandler;
                      }
                    })}
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
                    style="transition: transform 0.2s ease; position: relative; touch-action: pan-x;"
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
          ${this.options.shiftActionLabel
            ? html`<div class="prompt-instruction">
                <span class="prompt-instruction-command">⇧⏎</span>
                <span>${this.options.shiftActionLabel}</span>
              </div>`
            : nothing}
          ${Platform.isMobile
            ? html`
                <div class="prompt-instruction">
                  <span class="prompt-instruction-command">←</span>
                  <span>swipe left to accept</span>
                </div>
                ${this.options.shiftActionLabel
                  ? html`<div class="prompt-instruction">
                      <span class="prompt-instruction-command">→</span>
                      <span
                        >swipe right to
                        ${this.options.shiftActionLabel.toLowerCase()}</span
                      >
                    </div>`
                  : nothing}
              `
            : nothing}
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

  override onOpen(): void {
    this.accepted = false;

    this.renderTable();
  }

  // Swipe handling methods for mobile actions
  // Implements iOS-style swipe-to-reveal with action triggered on release
  // Swipe left = accept (shift: false), Swipe right = special action (shift: true)
  // Action is triggered only on release if swipe distance > 50px (fully highlighted)
  private createSwipeHandlers(rowIndex: number) {
    const handleStart = (e: TouchEvent | MouseEvent) => {
      if (!Platform.isMobile) return;

      const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
      const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;

      const element = (e.target as HTMLElement).closest("tr") as HTMLElement;
      if (!element) return;

      this.swipeStates.set(rowIndex, {
        startX: clientX,
        startY: clientY,
        currentX: clientX,
        isDragging: false,
        element,
      });
    };

    const handleMove = (e: TouchEvent | MouseEvent) => {
      const state = this.swipeStates.get(rowIndex);
      if (!state || !Platform.isMobile) return;

      const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
      const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;

      const deltaX = clientX - state.startX;
      const deltaY = clientY - state.startY;

      // Check if this is a horizontal swipe (not vertical scroll)
      if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 10) {
        if (!state.isDragging) {
          state.isDragging = true;
          e.preventDefault();
        }

        state.currentX = clientX;

        const swipeDistance = Math.min(Math.abs(deltaX), 100);
        // Handle left swipe (accept action)
        if (deltaX < 0) {
          state.element.style.transform = `translateX(-${swipeDistance}px)`;

          // Show accept action if not already shown
          if (
            swipeDistance > 30 &&
            (!state.actionElement ||
              !state.actionElement.classList.contains("oracle-row-swipe-left"))
          ) {
            this.showSwipeAction(state, rowIndex, "left");
          }
        }
        // Handle right swipe (special action - shift: true)
        else if (deltaX > 0 && this.options.shiftActionLabel) {
          state.element.style.transform = `translateX(${swipeDistance}px)`;

          // Show special action if not already shown
          if (
            swipeDistance > 30 &&
            (!state.actionElement ||
              !state.actionElement.classList.contains("oracle-row-swipe-right"))
          ) {
            this.showSwipeAction(state, rowIndex, "right");
          }
        }

        // Visual feedback when action is fully highlighted
        if (state.actionElement && swipeDistance > 50) {
          state.actionElement.style.backgroundColor =
            "var(--interactive-accent-hover)";
          // Don't apply scale transform here as we're already using transform for position
        } else if (state.actionElement) {
          state.actionElement.style.backgroundColor =
            "var(--interactive-accent)";
        }
      }
    };

    const handleEnd = () => {
      const state = this.swipeStates.get(rowIndex);
      if (!state || !Platform.isMobile) return;

      if (state.isDragging) {
        // Check if we should trigger an action based on swipe distance
        const deltaX = state.currentX - state.startX;
        const swipeDistance = Math.abs(deltaX);

        // Trigger action if the swipe distance is past the highlight threshold (50px)
        if (swipeDistance > 50 && state.actionElement) {
          if (deltaX < 0) {
            // Left swipe - regular accept
            this.triggerSwipeAction(rowIndex, false);
          } else if (deltaX > 0 && this.options.shiftActionLabel) {
            // Right swipe - special action
            this.triggerSwipeAction(rowIndex, true);
          }
        }

        // Reset positions and clean up action element
        state.element.style.transform = "";
        if (state.actionElement) {
          state.actionElement.style.transform = "";
          state.actionElement.remove();
        }
      }

      this.swipeStates.delete(rowIndex);
    };

    return { handleStart, handleMove, handleEnd };
  }

  // Shows the swipe action button that appears when swiping on mobile
  // direction: "left" for accept action, "right" for special action
  private showSwipeAction(
    state: SwipeState,
    rowIndex: number,
    direction: "left" | "right",
  ) {
    if (state.actionElement) {
      if (
        state.actionElement.classList.contains(`oracle-row-swipe-${direction}`)
      ) {
        return;
      } else {
        state.actionElement.remove();
        state.actionElement = undefined;
      }
    }

    const actionEl = document.createElement("div");
    actionEl.className = `oracle-row-swipe-action oracle-row-swipe-${direction}`;

    // Set text and position based on direction
    if (direction === "left") {
      actionEl.textContent = "Accept";
      actionEl.style.cssText = `
        position: absolute;
        top: 0;
        bottom: 0;
        left: 100%;
        width: 100px;
        background: var(--interactive-accent);
        color: var(--text-on-accent);
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: 500;
        z-index: 5;
        border-radius: 0 var(--radius-s) var(--radius-s) 0;
        box-shadow: -2px 0 4px rgba(0, 0, 0, 0.1);
        transition: opacity 0.2s ease, background-color 0.2s ease;
        font-size: 12px;
        text-align: center;
      `;
    } else {
      actionEl.textContent = this.options.shiftActionLabel || "Special";
      actionEl.style.cssText = `
        position: absolute;
        top: 0;
        bottom: 0;
        right: 100%;
        width: 100px;
        background: var(--interactive-accent);
        color: var(--text-on-accent);
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: 500;
        z-index: 5;
        border-radius: var(--radius-s) 0 0 var(--radius-s);
        box-shadow: 2px 0 4px rgba(0, 0, 0, 0.1);
        transition: opacity 0.2s ease, background-color 0.2s ease;
        font-size: 12px;
        text-align: center;
      `;
    }

    actionEl.addEventListener("click", (e) => {
      e.stopPropagation();
      this.triggerSwipeAction(rowIndex, direction === "right");
    });

    // Add touch feedback
    actionEl.addEventListener(
      "touchstart",
      () => {
        actionEl.style.opacity = "0.8";
      },
      { passive: true },
    );

    actionEl.addEventListener(
      "touchend",
      () => {
        actionEl.style.opacity = "1";
      },
      { passive: true },
    );

    state.element.style.position = "relative";
    state.element.style.overflow = "visible";

    // Add as child but position it outside the row bounds
    state.element.appendChild(actionEl);

    state.actionElement = actionEl;
  }

  // Triggers the appropriate swipe action for the specified row
  // shift: true for special action (right swipe), false for regular accept (left swipe)
  private triggerSwipeAction(rowIndex: number, shift: boolean) {
    // Update selection to the swiped row
    this.updateState((s) => s.updateSelection(() => rowIndex)).then(() => {
      // Trigger the appropriate action
      this.accept({ shift });
    });
  }

  accept(modifiers: { shift: boolean }): void {
    this.accepted = true;
    this.close();
    this.onAccept(this.rollContainer, modifiers);
  }

  override onClose(): void {
    const { contentEl } = this;

    // Clean up any remaining swipe states and event listeners
    this.cleanupSwipeHandlers();

    contentEl.empty();

    if (!this.accepted) {
      this.onCancel();
    }
  }

  // Clean up all swipe-related event listeners and states
  private cleanupSwipeHandlers() {
    // Clean up any remaining swipe states
    this.swipeStates.clear();

    // Clean up event listeners from table rows
    const tableRows = this.tableContainerEl.querySelectorAll("tr");
    tableRows.forEach((row) => {
      const swipeElement = row as SwipeEnabledElement;
      const handler = swipeElement.__swipeHandler;
      if (handler) {
        row.removeEventListener("touchstart", handler);
        delete swipeElement.__swipeHandler;
      }
    });

    // Clean up any remaining action elements from the table container
    const tableContainer = this.tableContainerEl.querySelector(
      ".iron-vault-oracle-table-container",
    );
    if (tableContainer) {
      const actionElements = tableContainer.querySelectorAll(
        ".oracle-row-swipe-action",
      );
      actionElements.forEach((el) => el.remove());
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

  override update(
    _part: ChildPart,
    [componentFn]: DirectiveParameters<this>,
  ): unknown {
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
