import { Move } from "@datasworn/core/dist/Datasworn";
import IronVaultPlugin from "index";
import {
  App,
  ButtonComponent,
  MarkdownRenderer,
  MarkdownView,
  Modal,
  setIcon,
} from "obsidian";
import { runMoveCommand, suggestedRollablesForMove } from "./action";
import { Datasworn } from "@datasworn/core";
import { html, render } from "lit-html";
import { map } from "lit-html/directives/map.js";
import { determineCharacterActionContext } from "characters/action-context";
import { ref } from "lit-html/directives/ref.js";

const TABLE_REGEX = /\{\{table:([^}]+)\}\}/g;

export class MoveModal extends Modal {
  plugin: IronVaultPlugin;
  move: Move;
  moveHistory: Move[] = [];

  constructor(app: App, plugin: IronVaultPlugin, move: Move) {
    super(app);
    this.plugin = plugin;
    this.move = move;
  }

  async openMove(move: Move) {
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
    await MarkdownRenderer.render(
      this.app,
      this.getMoveText(move),
      contentEl.createEl("div", { cls: "md-wrapper" }),
      ".",
      this.plugin,
    );
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

  getMoveText(move: Move) {
    let moveText = move.text;
    for (const match of move.text.matchAll(TABLE_REGEX)) {
      const oracle = this.plugin.datastore.oracles.get(match[1]);
      let oracleText = "";
      if (oracle) {
        const rollable = oracle.raw;
        let numColumns: number = 1;
        if (
          rollable.oracle_type == "table_text2" ||
          rollable.oracle_type == "column_text2"
        ) {
          numColumns = 2;
        } else if (
          rollable.oracle_type == "table_text3" ||
          rollable.oracle_type == "column_text3"
        ) {
          numColumns = 3;
        }
        oracleText += "| ";
        if ("column_labels" in rollable) {
          oracleText += rollable.column_labels.roll + "|";
          oracleText += rollable.column_labels.text + "|";
          if (numColumns >= 2) {
            oracleText += (rollable as Datasworn.OracleTableText2).column_labels
              .text2;
            oracleText += "|";
          }
          if (numColumns >= 3) {
            oracleText += (rollable as Datasworn.OracleTableText3).column_labels
              .text2;
            oracleText += "|";
          }
        }
        oracleText += "\n";
        oracleText += "|---|---|";
        if (numColumns >= 2) {
          oracleText += "---|";
        }
        if (numColumns >= 3) {
          oracleText += "---|";
        }
        oracleText += "\n";
        for (const row of rollable.rows) {
          oracleText +=
            row.min === row.max ? row.min : `${row.min} - ${row.max}`;
          oracleText += "|";
          oracleText += row.text;
          oracleText += "|";
          if (numColumns >= 2) {
            oracleText += (row as Datasworn.OracleTableRowText2).text2 ?? "";
            oracleText += "|";
          }
          if (numColumns >= 3) {
            oracleText += (row as Datasworn.OracleTableRowText3).text3 ?? "";
            oracleText += "|";
          }
          oracleText += "\n";
        }
        moveText = moveText.replaceAll(match[0], oracleText);
      }
    }
    return moveText;
  }
}
