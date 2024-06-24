import { PluginValue, ViewPlugin, ViewUpdate } from "@codemirror/view";
import { AssetModal } from "assets/asset-modal";
import { getHighestPriority } from "datastore/data-indexer";
import { DataswornSourced, DataswornTypes } from "datastore/datasworn-indexer";
import { extractDataswornLinkParts } from "datastore/parsers/datasworn/id";
import { rootLogger } from "logger";
import { MoveModal } from "moves/move-modal";
import { MarkdownRenderChild } from "obsidian";
import IronVaultPlugin from "./index";
import { OracleModal } from "./oracles/oracle-modal";

const logger = rootLogger.getLogger("link-handler");

export default function installLinkHandler(plugin: IronVaultPlugin) {
  const findEntry = (
    text: string | undefined,
  ): DataswornSourced | undefined => {
    const linkText = text?.toLowerCase();
    const dataswornLinkCandidate =
      linkText && extractDataswornLinkParts(linkText);
    if (dataswornLinkCandidate) {
      // TODO(@cwegrzyn): should use campaign context when ready? at the very least, should filter to enabled vs indexed?
      const entries = plugin.datastore.indexer.get(linkText);
      if (!entries) return undefined;

      const entry = getHighestPriority<DataswornTypes, keyof DataswornTypes>(
        entries,
      );

      // [...plugin.datastore.moves.values()].find(
      //   (m) =>
      //     m._id === id || m.name.replace(/\s*/g, "").toLowerCase() === id,
      // TODO(@zkat): Fetch them by name, actually

      return entry;
    }
    return undefined;
  };

  const present = (entry: DataswornSourced) => {
    switch (entry.kind) {
      case "move":
        new MoveModal(plugin.app, plugin, entry.value).open();
        break;
      case "asset":
        new AssetModal(plugin.app, plugin, entry.value).open();
        break;
      case "oracle":
        new OracleModal(plugin.app, plugin, entry.value).open();
        break;
      default:
        logger.warn("Clicked on link with '%s' but no modal exists!", entry.id);
    }
  };

  const handler = (ev: MouseEvent) => {
    if (
      !(ev.target instanceof HTMLAnchorElement) ||
      ev.target.href !== "app://obsidian.md/index.html#"
    )
      return;
    const editor = plugin.app.workspace.activeEditor?.editor;
    if (editor) {
      const token = editor.getClickableTokenAt(editor.posAtMouse(ev));
      const entry = findEntry(token?.text);
      if (entry) {
        ev.stopPropagation();
        ev.preventDefault();
        present(entry);
      }
    }
  };

  const cmPlugin = ViewPlugin.fromClass(
    class LinkOverride implements PluginValue {
      update(update: ViewUpdate) {
        const el = update.view.contentDOM;
        el.removeEventListener("click", handler);
        plugin.registerDomEvent(el, "click", handler);
      }
    },
  );

  plugin.registerEditorExtension([cmPlugin]);
  plugin.app.workspace.updateOptions();
  plugin.registerMarkdownPostProcessor((el, ctx) => {
    el.querySelectorAll("a").forEach((a) => {
      // If the link is a potential datasworn link, let's register a handler just in case.
      if (extractDataswornLinkParts(a.href)) {
        const component = new MarkdownRenderChild(a);
        ctx.addChild(component);
        component.registerDomEvent(a, "click", (ev) => {
          const entry = findEntry(a.href);
          if (entry) {
            ev.stopPropagation();
            ev.preventDefault();
            present(entry);
          }
        });
      }
    });
  });
}
