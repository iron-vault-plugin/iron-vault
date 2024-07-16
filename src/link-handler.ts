import { PluginValue, ViewPlugin, ViewUpdate } from "@codemirror/view";
import { AssetModal } from "assets/asset-modal";
import { DataswornSourced } from "datastore/datasworn-indexer";
import { extractDataswornLinkParts } from "datastore/parsers/datasworn/id";
import { rootLogger } from "logger";
import { MoveModal } from "moves/move-modal";
import { MarkdownRenderChild, Notice } from "obsidian";
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
    logger.trace("findEntry: %s -> %o", linkText, dataswornLinkCandidate);
    if (!dataswornLinkCandidate) return undefined;

    // First, try to find the entry by ID
    // TODO(@cwegrzyn): should use campaign context when ready? at the very least, should filter to enabled vs indexed?
    const entry = plugin.datastore.indexer.prioritized.get(
      dataswornLinkCandidate.id,
    );
    if (entry) return entry;

    // Then, search by name in the major asset types
    const entityType = dataswornLinkCandidate.kind;
    if (entityType != "move" && entityType != "oracle" && entityType != "asset")
      return undefined;

    function normalize(s: string) {
      return s.replaceAll(/\s*/g, "").toLowerCase();
    }
    const searchString = normalize(dataswornLinkCandidate.path);
    const index = plugin.datastore.indexer.prioritized.ofKind(entityType);
    for (const entry of index.values()) {
      if (normalize(entry.value.name) == searchString) return entry;
    }
    return entry;
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
      default: {
        const msg = `Iron Vault doesn't currently support displaying '${entry.value.type}' links.`;
        new Notice(msg);
        logger.warn(msg);
      }
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
      controller?: AbortController;

      update(update: ViewUpdate) {
        const el = update.view.contentDOM;
        this.controller?.abort();
        this.controller = new AbortController();
        plugin.registerDomEvent(el, "click", handler, {
          signal: this.controller.signal,
        });
      }

      destroy() {
        this.controller?.abort();
      }
    },
  );

  plugin.registerEditorExtension([cmPlugin]);
  plugin.app.workspace.updateOptions();
  plugin.registerMarkdownPostProcessor((el, ctx) => {
    el.querySelectorAll("a").forEach((a) => {
      // If the link is a potential datasworn link, let's register a handler just in case.
      const href = a.attributes.getNamedItem("href")?.textContent ?? "";
      if (extractDataswornLinkParts(href)) {
        const component = new MarkdownRenderChild(a);
        ctx.addChild(component);
        component.registerDomEvent(a, "click", (ev) => {
          const href =
            (ev.target as HTMLAnchorElement).attributes.getNamedItem("href")
              ?.textContent ?? undefined;
          const entry = findEntry(href);
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
