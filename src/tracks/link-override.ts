import { ViewPlugin, ViewUpdate } from "@codemirror/view";
import IronVaultPlugin from "index";
import { AssetModal } from "./asset-modal";

export default function installAssetLinkHandler(plugin: IronVaultPlugin) {
  const handler = (ev: MouseEvent) => {
    if (
      !(ev.target instanceof HTMLAnchorElement) ||
      ev.target.href !== "app://obsidian.md/index.html#"
    )
      return;
    const editor = plugin.app.workspace.activeEditor?.editor;
    if (editor) {
      const token = editor.getClickableTokenAt(editor.posAtMouse(ev));
      if (token && token.text.toLowerCase().startsWith("asset:")) {
        ev.stopPropagation();
        ev.preventDefault();
        const id = token.text
          .slice("asset:".length)
          .replace(/\s*/g, "")
          .toLowerCase();
        const asset = [...plugin.datastore.assets.values()].find(
          (m) =>
            m._id === id || m.name.replace(/\s*/g, "").toLowerCase() === id,
        );
        if (asset) {
          new AssetModal(plugin.app, plugin, asset).open();
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
      if (a.href.startsWith("asset:")) {
        const id = a.href
          .slice("asset:".length)
          .replace(/\s*/g, "")
          .toLowerCase();
        const asset = [...plugin.datastore.assets.values()].find(
          (m) =>
            m._id === id || m.name.replace(/\s*/g, "").toLowerCase() === id,
        );
        const handler = (ev: MouseEvent) => {
          ev.stopPropagation();
          ev.preventDefault();
          if (asset) {
            new AssetModal(plugin.app, plugin, asset).open();
          }
        };
        a.addEventListener("click", handler);
        plugin.register(() => a.removeEventListener("click", handler));
      }
    });
  });
}
