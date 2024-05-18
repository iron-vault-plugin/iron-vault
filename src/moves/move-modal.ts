import { Move } from "@datasworn/core/dist/Datasworn";
import ForgedPlugin from "index";
import { runMoveCommand } from "moves/action";
import {
  App,
  ButtonComponent,
  MarkdownRenderer,
  MarkdownView,
  Modal,
} from "obsidian";

export class MoveModal extends Modal {
  plugin: ForgedPlugin;
  move: Move;
  moveHistory: Move[] = [];

  constructor(app: App, plugin: ForgedPlugin, move: Move) {
    super(app);
    this.plugin = plugin;
    this.move = move;
  }

  openMove(move: Move) {
    this.setTitle(move.name);
    const { contentEl } = this;
    contentEl.empty();
    (async () => {
      if (move.roll_type !== "no_roll") {
        new ButtonComponent(contentEl)
          .setButtonText("Roll this move")
          .onClick(() => {
            const { workspace } = this.plugin.app;
            const editor = workspace.activeEditor?.editor;
            const view = workspace.getActiveViewOfType(MarkdownView);
            if (editor && view) {
              runMoveCommand(this.plugin, editor, view);
            }
          });
      }
      await MarkdownRenderer.render(
        this.app,
        move.text,
        contentEl,
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
          ev.preventDefault();
          ev.stopPropagation();
          const newMove = this.plugin.datastore.moves.find(
            (move) => move._id === id,
          );
          if (newMove) {
            this.moveHistory.push(move);
            this.openMove(newMove);
          }
        });
      }
    })();
  }

  onOpen() {
    this.openMove(this.move);
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}
