import { Asset } from "@datasworn/core/dist/Datasworn";
import { html, render } from "lit-html";

import IronVaultPlugin from "index";
import renderAssetCard from "./asset-card";

export default function registerAssetBlock(plugin: IronVaultPlugin) {
  plugin.registerMarkdownCodeBlockProcessor(
    "iron-vault-asset",
    async (source, el: AssetBlockContainerEl, _ctx) => {
      // We can't render blocks until datastore is ready.
      await plugin.datastore.waitForReady;
      if (!el.assetRenderer) {
        const asset = AssetBlockRenderer.getAsset(plugin, source);
        if (!asset) {
          render(html`<p>No such asset: ${source}</p>`, el);
          return;
        }
        el.assetRenderer = new AssetBlockRenderer(el, plugin, asset);
      }
      await el.assetRenderer.render();
    },
  );
}

interface AssetBlockContainerEl extends HTMLElement {
  assetRenderer?: AssetBlockRenderer;
}

class AssetBlockRenderer {
  contentEl: HTMLElement;
  plugin: IronVaultPlugin;
  asset: Asset;

  constructor(contentEl: HTMLElement, plugin: IronVaultPlugin, asset: Asset) {
    this.contentEl = contentEl;
    this.plugin = plugin;
    this.asset = asset;
  }

  static getAsset(plugin: IronVaultPlugin, source: string) {
    const trimmed = source.trim().toLowerCase();
    return (
      plugin.datastore.assets.get(trimmed) ||
      [...plugin.datastore.assets.values()].find(
        (a) => a.name.toLowerCase() === trimmed,
      )
    );
  }
  async render() {
    render(
      renderAssetCard(this.plugin, {
        id: this.asset._id,
        abilities: [true, false, false],
        options: {},
        controls: {},
      }),
      this.contentEl,
    );
  }
}
