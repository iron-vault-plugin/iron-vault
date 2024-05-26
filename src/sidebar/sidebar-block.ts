import IronVaultPlugin from "index";
import renderIronVaultOracles from "./oracles";
import renderIronVaultMoves from "./moves";

// These are intended for folks who want to get the stuff that's usualy in the
// sidebar, but embedded in a note directly.

export default function registerSidebarBlocks(plugin: IronVaultPlugin) {
  plugin.registerMarkdownCodeBlockProcessor(
    "iron-vault-moves",
    async (_source, el: SidebarBlockContainerEl, _ctx) => {
      // We can't render blocks until datastore is ready.
      await plugin.datastore.waitForReady;
      if (!el.movesRenderer) {
        el.movesRenderer = new MovesRenderer(el, plugin);
      }
      await el.movesRenderer.render();
    },
  );

  plugin.registerMarkdownCodeBlockProcessor(
    "iron-vault-oracles",
    async (_source, el: SidebarBlockContainerEl, _ctx) => {
      // We can't render blocks until datastore is ready.
      await plugin.datastore.waitForReady;
      if (!el.oracleRenderer) {
        el.oracleRenderer = new OracleRenderer(el, plugin);
      }
      await el.oracleRenderer.render();
    },
  );
}

interface SidebarBlockContainerEl extends HTMLElement {
  movesRenderer?: MovesRenderer;
  oracleRenderer?: OracleRenderer;
}

abstract class SidebarBlockRenderer {
  contentEl: HTMLElement;
  plugin: IronVaultPlugin;

  constructor(contentEl: HTMLElement, plugin: IronVaultPlugin) {
    this.contentEl = contentEl;
    this.plugin = plugin;
  }
  abstract render(): Promise<void>;
}

class MovesRenderer extends SidebarBlockRenderer {
  async render() {
    await renderIronVaultMoves(this.contentEl, this.plugin);
  }
}

class OracleRenderer extends SidebarBlockRenderer {
  async render() {
    await renderIronVaultOracles(this.contentEl, this.plugin);
  }
}
