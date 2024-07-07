import { determineCharacterActionContext } from "characters/action-context";
import { AnyDataswornMove } from "datastore/datasworn-indexer";
import IronVaultPlugin from "index";
import { html, render } from "lit-html";
import { map } from "lit-html/directives/map.js";
import { ref } from "lit-html/directives/ref.js";
import {
  App,
  ButtonComponent,
  MarkdownRenderer,
  MarkdownView,
  Modal,
  setIcon,
} from "obsidian";
import { runMoveCommand, suggestedRollablesForMove } from "./action";
import { runOracleCommand } from "oracles/command";
import { generateOracleTable } from "oracles/render";

const TABLE_REGEX = /\{\{table>([^}]+)\}\}/g;

export class MoveModal extends Modal {
  plugin: IronVaultPlugin;
  move: AnyDataswornMove;
  moveHistory: AnyDataswornMove[] = [];

  constructor(app: App, plugin: IronVaultPlugin, move: AnyDataswornMove) {
    super(app);
    this.plugin = plugin;
    this.move = move;
  }

  async openMove(move: AnyDataswornMove) {
    this.setTitle(move.name);
    const { contentEl } = this;
    contentEl.empty();
    contentEl.toggleClass("iron-vault-modal-content", true);
    contentEl.toggleClass("iron-vault-modal", true);
    contentEl.toggleClass("iron-vault-move-modal", true);
    const context = await determineCharacterActionContext(this.plugin);
    const suggested =
      move.roll_type === "action_roll" && suggestedRollablesForMove(move);
    if (suggested) {
      const rollsList = contentEl.createEl("ul", { cls: "rollable-stats" });
      contentEl.appendChild(rollsList);
      const rollables = context.rollables.filter((r) => suggested[r.key]);
      render(
        html`${map(
          rollables,
          (meter) => html`
            <li
              @click=${() => {
                const { workspace } = this.plugin.app;
                const view = workspace.getActiveFileView();
                if (view && view instanceof MarkdownView) {
                  const editor = view.editor;
                  runMoveCommand(this.plugin, editor, view, move, meter);
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
        const { workspace } = this.plugin.app;
        const view = workspace.getActiveFileView();
        if (view && view instanceof MarkdownView) {
          const editor = view.editor;
          runMoveCommand(this.plugin, editor, view, move);
          this.close();
        }
      });
    const { moveText, oracles } = await this.getMoveText(move);
    await MarkdownRenderer.render(
      this.app,
      moveText,
      contentEl.createEl("div", { cls: "md-wrapper" }),
      ".",
      this.plugin,
    );
    for (const { oracleText, oracle } of oracles) {
      new ButtonComponent(contentEl)
        .setButtonText(`Roll ${oracle.name}`)
        .setTooltip(`Roll on the ${oracle.name} oracle.`)
        .onClick(() => {
          const { workspace } = this.plugin.app;
          const view = workspace.getActiveFileView();
          if (view && view instanceof MarkdownView) {
            const editor = view.editor;
            runOracleCommand(this.plugin, editor, view, oracle);
            this.close();
          }
        });
      await MarkdownRenderer.render(
        this.app,
        oracleText,
        contentEl.createEl("div", { cls: "md-wrapper" }),
        ".",
        this.plugin,
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
        const newMove = this.plugin.datastore.moves.get(id);
        if (newMove) {
          this.moveHistory.push(move);
          this.openMove(newMove);
        }
      });
    }
  }

  onOpen() {
    this.openMove(this.move);
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }

  async getMoveText(move: AnyDataswornMove) {
    let moveText = move.text;
    const oracles = [];
    for (const match of move.text.matchAll(TABLE_REGEX)) {
      const oracle = this.plugin.datastore.oracles.get(match[1]);
      if (oracle) {
        const dom = await generateOracleTable(this.plugin, oracle);
        const oracleText = dom.outerHTML + "\n";
        oracles.push({ oracleText, oracle });
        moveText = moveText.replaceAll(match[0], "");
      }
    }
    return { moveText, oracles };
  }
}
