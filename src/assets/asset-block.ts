import { Asset } from "@datasworn/core/dist/Datasworn";
import { html, render } from "lit-html";

import { IDataContext } from "datastore/data-context";
import IronVaultPlugin from "index";
import renderAssetCard from "./asset-card";

export default function registerAssetBlock(plugin: IronVaultPlugin) {
  plugin.registerMarkdownCodeBlockProcessor(
    "iron-vault-asset",
    async (source, el: AssetBlockContainerEl, _ctx) => {
      // We can't render blocks until datastore is ready.
      await plugin.datastore.waitForReady;
      if (!el.assetRenderer) {
        // TODO(@cwegrzyn): instead of pulling the asset from
        // the plugin datacontext here, we should have some
        // way of "watching" the current file's data context
        const asset = AssetBlockRenderer.getAsset(
          plugin.datastore.dataContext,
          source,
        );
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
  dataContext: IDataContext;
  asset: Asset;

  constructor(contentEl: HTMLElement, plugin: IronVaultPlugin, asset: Asset) {
    this.contentEl = contentEl;
    this.plugin = plugin;
    this.asset = asset;
    // TODO(@cwegrzyn): should this use a campaign data context?
    this.dataContext = plugin.datastore.dataContext;
  }

  static getAsset(dataContext: IDataContext, source: string) {
    const trimmed = source.trim().toLowerCase();
    return (
      dataContext.assets.get(trimmed) ||
      [...dataContext.assets.values()].find(
        (a) => a.name.toLowerCase() === trimmed,
      )
    );
  }

  async render() {
    render(
      renderAssetCard(this.plugin, this.dataContext, {
        id: this.asset._id,
        abilities: [true, false, false],
        options: {},
        controls: {},
      }),
      this.contentEl,
    );
  }
}
