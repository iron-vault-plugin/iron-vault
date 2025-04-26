import { PluginValue, ViewPlugin, ViewUpdate } from "@codemirror/view";
import { AssetModal } from "assets/asset-modal";
import { ICompleteDataContext, IDataContext } from "datastore/data-context";
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
    dataContext: ICompleteDataContext,
    text: string | undefined,
  ): DataswornSourced | undefined => {
    const linkText = text?.toLowerCase();
    const dataswornLinkCandidate =
      linkText && extractDataswornLinkParts(linkText);
    logger.trace("findEntry: %s -> %o", linkText, dataswornLinkCandidate);
    if (!dataswornLinkCandidate) return undefined;

    // First, try to find the entry by ID
    const entry = dataContext.prioritized.get(dataswornLinkCandidate.id);
    if (entry) return entry;

    // Then, search by name in the major asset types
    const entityType = dataswornLinkCandidate.kind;
    if (entityType != "move" && entityType != "oracle" && entityType != "asset")
      return undefined;

    function normalize(s: string) {
      return s.replaceAll(/\s*/g, "").toLowerCase();
    }
    const searchString = normalize(dataswornLinkCandidate.path);
    const index = dataContext.prioritized.ofKind(entityType);
    for (const entry of index.values()) {
      if (normalize(entry.value.name) == searchString) return entry;
    }
    return entry;
  };

  const present = (dataContext: IDataContext, entry: DataswornSourced) => {
    switch (entry.kind) {
      case "move":
        new MoveModal(plugin.app, plugin, dataContext, entry.value).open();
        break;
      case "asset":
        new AssetModal(plugin.app, plugin, dataContext, entry.value).open();
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
    const view = plugin.app.workspace.activeEditor;
    const editor = view?.editor;
    const token = editor && editor.getClickableTokenAt(editor.posAtMouse(ev));
    if (view?.file && token) {
      const campaign = plugin.campaignManager.campaignForFile(view.file);
      const context =
        campaign == null
          ? plugin.datastore.dataContext
          : plugin.campaignManager.campaignContextFor(campaign);
      const entry = findEntry(context, token.text);
      if (entry) {
        ev.stopPropagation();
        ev.preventDefault();
        present(context, entry);
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
    // We get the file, since it survives renames, but sometimes these markdown blocks don't
    // re-render on a rename!
    // TODO(@cwegrzyn): if we could get the view from the click event, that might be better. Is
    //   that just the active view? That feels gross, but it does seem to make sense...
    const file = plugin.app.vault.getFileByPath(ctx.sourcePath);
    const component = new MarkdownRenderChild(el);
    ctx.addChild(component);
    component.registerDomEvent(el, "click", (ev) => {
      if (!(ev.target instanceof HTMLAnchorElement)) return;
      // If the link is not a datasworn link, we don't handle it.
      if (!ev.target.dataset.dataswornId) return;
      const campaign = file && plugin.campaignManager.campaignForFile(file);
      const dataContext =
        campaign == null
          ? plugin.datastore.dataContext
          : plugin.campaignManager.campaignContextFor(campaign);
      const href =
        (ev.target as HTMLAnchorElement).attributes.getNamedItem("href")
          ?.textContent ?? undefined;
      const entry = findEntry(dataContext, href);
      if (entry) {
        ev.stopPropagation();
        ev.preventDefault();
        present(dataContext, entry);
      }
    });

    el.querySelectorAll("a").forEach((a) => {
      // If the link is a potential datasworn link, let's register a handler just in case.
      const href = a.attributes.getNamedItem("href")?.textContent ?? "";
      const parsedLink = extractDataswornLinkParts(href);
      if (parsedLink) {
        a.dataset.dataswornId = parsedLink.id;
        a.dataset.dataswornKind = parsedLink.kind;
      } else {
        delete a.dataset.dataswornId;
        delete a.dataset.dataswornKind;
      }
    });
  });
}
