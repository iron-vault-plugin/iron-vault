import ForgedPlugin from "index";
import { MoveModal } from "./move-modal";
import { ViewPlugin, ViewUpdate } from "@codemirror/view";

export default function installMoveLinkHandler(plugin: ForgedPlugin) {
  const handler = (ev: MouseEvent) => {
    if (
      !(ev.target instanceof HTMLAnchorElement) ||
      ev.target.href !== "app://obsidian.md/index.html#"
    )
      return;
    const editor = plugin.app.workspace.activeEditor?.editor;
    if (editor) {
      const token = editor.getClickableTokenAt(editor.posAtMouse(ev));
      if (token && token.text.toLowerCase().startsWith("move:")) {
        ev.stopPropagation();
        ev.preventDefault();
        const id = token.text
          .slice("move:".length)
          .replace(/\s*/g, "")
          .toLowerCase();
        const move = plugin.datastore.moves.find(
          (m) =>
            m._id === id || m.name.replace(/\s*/g, "").toLowerCase() === id,
        );
        if (move) {
          new MoveModal(plugin.app, plugin, move).open();
        }
      }
    }
  };
  const cmPlugin = ViewPlugin.fromClass(
    class LinkOverride {
      update(update: ViewUpdate) {
        const el = update.view.contentDOM;
        el.removeEventListener("click", handler);
        el.addEventListener("click", handler);
        plugin.register(() => el.removeEventListener("click", handler));
      }
    },
  );
  plugin.registerEditorExtension([cmPlugin]);
  plugin.app.workspace.updateOptions();
  plugin.registerMarkdownPostProcessor((el) => {
    el.querySelectorAll("a").forEach((a) => {
      if (a.href.startsWith("move:")) {
        const id = a.href
          .slice("move:".length)
          .replace(/\s*/g, "")
          .toLowerCase();
        const move = plugin.datastore.moves.find(
          (m) =>
            m._id === id || m.name.replace(/\s*/g, "").toLowerCase() === id,
        );
        const handler = (ev: MouseEvent) => {
          ev.stopPropagation();
          ev.preventDefault();
          if (move) {
            new MoveModal(plugin.app, plugin, move).open();
          }
        };
        a.addEventListener("click", handler);
        plugin.register(() => a.removeEventListener("click", handler));
      }
    });
  });
}
