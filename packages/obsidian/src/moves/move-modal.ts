import {
  determineCharacterActionContext,
  IActionContext,
} from "characters/action-context";
import { MeterWithLens, MeterWithoutLens } from "characters/lens";
import { IDataContext } from "datastore/data-context";
import {
  AnyDataswornMove,
  DataswornTypes,
  scopeSourceForMove,
  WithMetadata,
} from "datastore/datasworn-indexer";
import IronVaultPlugin from "index";
import { html, render } from "lit-html";
import { map } from "lit-html/directives/map.js";
import { ref } from "lit-html/directives/ref.js";
import { Oracle } from "model/oracle";
import {
  App,
  ButtonComponent,
  Component,
  MarkdownRenderChild,
  MarkdownRenderer,
  MarkdownView,
  Modal,
  setIcon,
} from "obsidian";
import { runOracleCommand } from "oracles/command";
import { generateOracleTable } from "oracles/render";
import { runMoveCommand, suggestedRollablesForMove } from "./action";

const TABLE_REGEX = /\{\{(table(?:_columns)?)>([^}]+)\}\}/g;

export class MoveModal extends Modal {
  moveHistory: AnyDataswornMove[] = [];
  modalComponent: Component;

  constructor(
    app: App,
    readonly plugin: IronVaultPlugin,
    readonly dataContext: IDataContext,
    readonly move: AnyDataswornMove,
  ) {
    super(app);
    this.modalComponent = new Component();
  }

  private getActiveMarkdownView(): MarkdownView | undefined {
    const view = this.plugin.app.workspace.getActiveFileView();
    return view && view instanceof MarkdownView ? view : undefined;
  }

  async openMove(move: DataswornTypes["move"]) {
    this.setTitle(move.name);
    const { contentEl } = this;
    contentEl.empty();
    contentEl.toggleClass("iron-vault-modal-content", true);
    contentEl.toggleClass("iron-vault-modal", true);
    contentEl.toggleClass("iron-vault-move-modal", true);
    contentEl.createEl("header", {
      text: scopeSourceForMove(move).title,
    });

    const view = this.getActiveMarkdownView();
    // NOTE(@cwegrzyn): I've taken the approach here that if there is no active view, let's
    // not prompt the user for a campaign/character just to view a move.
    const context =
      view && (await determineCharacterActionContext(this.plugin, view));

    await MoveRenderer.render(
      contentEl.createEl("div", { cls: "md-wrapper" }),
      this.plugin,
      this.dataContext,
      move,
      this.modalComponent,
      {
        actionContext: context,
        onMakeMove: (move, meter) => {
          const view = this.getActiveMarkdownView();
          if (view) {
            runMoveCommand(this.plugin, view.editor, view, move, meter);
          }
          this.close();
        },
        onRollOracle: (oracle) => {
          const view = this.getActiveMarkdownView();
          if (view) {
            runOracleCommand(this.plugin, view.editor, view, oracle);
          }
          this.close();
        },
        showOracles: true,
        onClickDataswornLink: (id, ev) => {
          ev.preventDefault();
          ev.stopImmediatePropagation();
          const newMove = this.dataContext.moves.get(id);
          if (newMove) {
            this.moveHistory.push(move);
            this.openMove(newMove);
          }
        },
      },
    );

    if (this.moveHistory.length) {
      new ButtonComponent(contentEl)
        .setButtonText("Back")
        .setTooltip("Go back to the previous move.")
        .onClick(() => {
          this.openMove(this.moveHistory.pop()!);
        });
    }
  }

  onOpen() {
    this.modalComponent.load();
    this.openMove(this.move);
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
    this.modalComponent.unload();
  }
}

export type MoveRendererOptions = {
  actionContext?: IActionContext;
  onMakeMove?: (
    move: AnyDataswornMove,
    meter?: MeterWithLens | MeterWithoutLens,
  ) => void | Promise<void>;
  showOracles?: boolean;
  onRollOracle?: (oracle: WithMetadata<Oracle>) => void | Promise<void>;
  onClickDataswornLink?: (id: string, ev: MouseEvent) => void | Promise<void>;
};

/** A Component that represents a rendering of a move definition. */
export class MoveRenderer extends MarkdownRenderChild {
  rollsEl: HTMLUListElement | undefined = undefined;
  actionContext: IActionContext | undefined;

  /** Render a move into the given container element. */
  static async render(
    container: HTMLElement,
    plugin: IronVaultPlugin,
    dataContext: IDataContext,
    move: AnyDataswornMove,
    component: Component,
    options: MoveRendererOptions = {},
  ): Promise<MoveRenderer> {
    const renderer = new MoveRenderer(
      container,
      plugin,
      dataContext,
      move,
      options,
    );
    component.addChild(renderer);
    await renderer.initialize();
    return renderer;
  }

  constructor(
    readonly containerEl: HTMLElement,
    readonly plugin: IronVaultPlugin,
    readonly dataContext: IDataContext,
    readonly move: AnyDataswornMove,
    readonly options: MoveRendererOptions,
  ) {
    super(containerEl);
    this.actionContext = options.actionContext;
  }

  onunload(): void {
    this.containerEl.empty();
    super.onunload();
  }

  updateActionContext(actionContext: IActionContext | undefined): void {
    this.actionContext = actionContext;
    if (this.rollsEl && actionContext) {
      this.renderRolls(this.rollsEl, actionContext);
    }
  }

  renderRolls(rollsEl: HTMLElement, context: IActionContext) {
    const suggested =
      this.move.roll_type === "action_roll" &&
      suggestedRollablesForMove(this.move);
    if (!suggested) {
      rollsEl.empty();
      return;
    }

    const rollables = context.rollables.filter((r) => suggested[r.key]);
    render(
      html`${map(
        rollables,
        (meter) => html`
          <li @click=${() => this.options.onMakeMove?.(this.move, meter)}>
            <dl>
              <dt data-value=${meter.definition.label}>
                ${meter.definition.label}
              </dt>
              <dd data-value=${meter.value}>
                <span
                  ${ref((el) => el && setIcon(el as HTMLElement, "dice"))}
                ></span>
                <span>+</span>
                <span>${meter.value}</span>
              </dd>
            </dl>
          </li>
        `,
      )}`,
      rollsEl,
    );
  }

  async initialize(): Promise<void> {
    const { containerEl } = this;

    if (this.options.onMakeMove) {
      const moveButtonsEl = containerEl.createDiv("iron-vault-move-buttons");

      const context = this.actionContext;
      const suggested =
        this.move.roll_type === "action_roll" &&
        suggestedRollablesForMove(this.move);
      if (suggested && context) {
        this.rollsEl = moveButtonsEl.createEl("ul", {
          cls: "rollable-stats",
        });

        this.renderRolls(this.rollsEl, context);
      }
      new ButtonComponent(moveButtonsEl)
        .setButtonText("Make this move with prompts")
        .onClick(() => this.options.onMakeMove?.(this.move));
    }

    const { moveText, oracles } = await this.getMoveText(this.move);

    // Render the move text
    await MarkdownRenderer.render(
      this.plugin.app,
      moveText,
      this.containerEl,
      ".", // TODO: i can make this an optional constructor param
      this,
    );

    // Render oracles
    if (this.options.showOracles) {
      for (const { oracleText, oracle } of oracles) {
        const oracleEl = this.containerEl.createEl("div", {
          cls: "move-oracle",
        });
        if (this.options.onRollOracle) {
          const callback = this.options.onRollOracle;
          new ButtonComponent(oracleEl)
            .setButtonText(`Roll ${oracle.name}`)
            .setTooltip(`Roll on the ${oracle.name} oracle.`)
            .onClick(() => callback(oracle));
        }
        await MarkdownRenderer.render(
          this.plugin.app,
          oracleText,
          oracleEl,
          ".",
          this,
        );
      }
    }

    const onClickDataswornLink = this.options.onClickDataswornLink;
    if (onClickDataswornLink) {
      console.debug("MoveRenderer: adding click handlers for links");
      for (const child of this.containerEl.querySelectorAll(
        "a[data-datasworn-id]",
      )) {
        if (!(child instanceof HTMLAnchorElement)) continue;

        child.addEventListener("click", (ev) => {
          const id = (ev.currentTarget as HTMLAnchorElement).dataset
            .dataswornId;
          if (!id) return;
          onClickDataswornLink(id, ev);
        });
      }
    }
  }

  async getMoveText(move: AnyDataswornMove) {
    let moveText = move.text;
    const oracles = [];
    for (const match of move.text.matchAll(TABLE_REGEX)) {
      const type = match[1];
      if (type === "table") {
        const oracle = this.dataContext.oracles.get(match[2]);
        if (oracle) {
          const dom = await generateOracleTable(this.plugin.app, oracle, this);
          const oracleText = dom.outerHTML + "\n";
          oracles.push({ oracleText, oracle });
          moveText = moveText.replaceAll(match[0], "");
        }
      } else if (type === "table_columns" && match[2].startsWith("move:")) {
        const prefix =
          match[2].replace(/^move:/, "move.oracle_rollable:") + ".";
        for (const [oracleId, oracle] of this.dataContext.oracles.entries()) {
          if (oracleId.startsWith(prefix)) {
            const dom = await generateOracleTable(
              this.plugin.app,
              oracle,
              this,
            );
            const oracleText = dom.outerHTML + "\n";
            oracles.push({ oracleText, oracle });
            moveText = moveText.replaceAll(match[0], "");
          }
        }
      }
    }
    return { moveText, oracles };
  }
}
