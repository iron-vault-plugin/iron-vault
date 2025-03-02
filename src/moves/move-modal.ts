import { determineCharacterActionContext } from "characters/action-context";
import { IDataContext } from "datastore/data-context";
import {
  AnyDataswornMove,
  DataswornTypes,
  scopeSourceForMove,
} from "datastore/datasworn-indexer";
import IronVaultPlugin from "index";
import { html, render } from "lit-html";
import { map } from "lit-html/directives/map.js";
import { ref } from "lit-html/directives/ref.js";
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

const TABLE_REGEX = /\{\{table>([^}]+)\}\}/g;

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
    const suggested =
      move.roll_type === "action_roll" && suggestedRollablesForMove(move);
    if (suggested && context) {
      const rollsList = contentEl.createEl("ul", { cls: "rollable-stats" });
      contentEl.appendChild(rollsList);
      const rollables = context.rollables.filter((r) => suggested[r.key]);
      render(
        html`${map(
          rollables,
          (meter) => html`
            <li
              @click=${() => {
                const view = this.getActiveMarkdownView();
                if (view) {
                  runMoveCommand(this.plugin, view.editor, view, move, meter);
                  this.close();
                }
              }}
            >
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
        rollsList,
      );
    }
    new ButtonComponent(contentEl)
      .setButtonText("Make this move with prompts")
      .onClick(() => {
        const view = this.getActiveMarkdownView();
        if (view) {
          runMoveCommand(this.plugin, view.editor, view, move);
          this.close();
        }
      });
    const { moveText, oracles } = await this.getMoveText(move);
    await MarkdownRenderer.render(
      this.app,
      moveText,
      contentEl.createEl("div", { cls: "md-wrapper" }),
      ".",
      this.modalComponent,
    );
    for (const { oracleText, oracle } of oracles) {
      new ButtonComponent(contentEl)
        .setButtonText(`Roll ${oracle.name}`)
        .setTooltip(`Roll on the ${oracle.name} oracle.`)
        .onClick(() => {
          const view = this.getActiveMarkdownView();
          if (view) {
            runOracleCommand(this.plugin, view.editor, view, oracle);
            this.close();
          }
        });
      await MarkdownRenderer.render(
        this.app,
        oracleText,
        contentEl.createEl("div", { cls: "md-wrapper" }),
        ".",
        this.modalComponent,
      );
    }
    if (this.moveHistory.length) {
      new ButtonComponent(contentEl)
        .setButtonText("Back")
        .setTooltip("Go back to the previous move.")
        .onClick(() => {
          this.openMove(this.moveHistory.pop()!);
        });
    }
    for (const child of contentEl.querySelectorAll('a[href^="id:"]')) {
      child.addEventListener("click", (ev) => {
        const id = child.getAttribute("href")?.slice(3);
        if (!id) return;
        ev.preventDefault();
        ev.stopPropagation();
        const newMove = this.dataContext.moves.get(id);
        if (newMove) {
          this.moveHistory.push(move);
          this.openMove(newMove);
        }
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

  async getMoveText(move: AnyDataswornMove) {
    let moveText = move.text;
    const oracles = [];
    for (const match of move.text.matchAll(TABLE_REGEX)) {
      const oracle = this.dataContext.oracles.get(match[1]);
      if (oracle) {
        const dom = await generateOracleTable(
          this.app,
          oracle,
          this.modalComponent,
        );
        const oracleText = dom.outerHTML + "\n";
        oracles.push({ oracleText, oracle });
        moveText = moveText.replaceAll(match[0], "");
      }
    }
    return { moveText, oracles };
  }
}

export class MoveRenderer extends MarkdownRenderChild {
  static async render(
    plugin: IronVaultPlugin,
    dataContext: IDataContext,
    move: AnyDataswornMove,
    component: Component,
  ): Promise<MoveRenderer> {
    const container = document.createElement("div");
    const renderer = new MoveRenderer(container, plugin, dataContext, move);
    component.addChild(renderer);
    await renderer.render();
    return renderer;
  }

  constructor(
    readonly containerEl: HTMLElement,
    readonly plugin: IronVaultPlugin,
    readonly dataContext: IDataContext,
    readonly move: AnyDataswornMove,
  ) {
    super(containerEl);
  }

  async render(): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { moveText, oracles } = await this.getMoveText(this.move);
    await MarkdownRenderer.render(
      this.plugin.app,
      moveText,
      this.containerEl.createEl("div", { cls: "md-wrapper" }),
      ".", // TODO: i can make this an optional constructor param
      this,
    );
  }

  async getMoveText(move: AnyDataswornMove) {
    let moveText = move.text;
    const oracles = [];
    for (const match of move.text.matchAll(TABLE_REGEX)) {
      const oracle = this.dataContext.oracles.get(match[1]);
      if (oracle) {
        const dom = await generateOracleTable(this.plugin.app, oracle, this);
        const oracleText = dom.outerHTML + "\n";
        oracles.push({ oracleText, oracle });
        moveText = moveText.replaceAll(match[0], "");
      }
    }
    return { moveText, oracles };
  }
}
