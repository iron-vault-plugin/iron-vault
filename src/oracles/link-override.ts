import IronVaultPlugin from "index";
import { OracleModal } from "./oracle-modal";
import { ViewPlugin, ViewUpdate } from "@codemirror/view";

export default function installOracleLinkHandler(plugin: IronVaultPlugin) {
  const handler = (ev: MouseEvent) => {
    if (
      !(ev.target instanceof HTMLAnchorElement) ||
      ev.target.href !== "app://obsidian.md/index.html#"
    )
      return;
    const editor = plugin.app.workspace.activeEditor?.editor;
    if (editor) {
      const token = editor.getClickableTokenAt(editor.posAtMouse(ev));
      if (token && token.text.toLowerCase().startsWith("oracle:")) {
        ev.stopPropagation();
        ev.preventDefault();
        const id = token.text
          .slice("oracle:".length)
          .replace(/\s*/g, "")
          .toLowerCase();
        const oracle = plugin.datastore.oracles.get(id);
        if (oracle) {
          new OracleModal(plugin.app, plugin, oracle).open();
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
      if (a.href.startsWith("oracle:")) {
        const id = a.href
          .slice("oracle:".length)
          .replace(/\s*/g, "")
          .toLowerCase();
        // TODO(@zkat): Fetch them by name, actually
        const oracle = plugin.datastore.oracles.get(id);
        const handler = (ev: MouseEvent) => {
          ev.stopPropagation();
          ev.preventDefault();
          if (oracle) {
            new OracleModal(plugin.app, plugin, oracle).open();
          }
        };
        a.addEventListener("click", handler);
        plugin.register(() => a.removeEventListener("click", handler));
      }
    });
  });
}
