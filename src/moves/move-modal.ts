import { Move } from "@datasworn/core/dist/Datasworn";
import IronVaultPlugin from "index";
import {
  App,
  ButtonComponent,
  MarkdownRenderer,
  MarkdownView,
  Modal,
} from "obsidian";
import { runMoveCommand } from "./action";

export class MoveModal extends Modal {
  plugin: IronVaultPlugin;
  move: Move;
  moveHistory: Move[] = [];

  constructor(app: App, plugin: IronVaultPlugin, move: Move) {
    super(app);
    this.plugin = plugin;
    this.move = move;
  }

  openMove(move: Move) {
    this.setTitle(move.name);
    const { contentEl } = this;
    contentEl.empty();
    contentEl.toggleClass("iron-vault-modal-content", true);
    (async () => {
      new ButtonComponent(contentEl)
        .setButtonText("Make this move")
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
