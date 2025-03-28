import { html, render } from "lit-html";

import { FileBasedCampaignWatch } from "campaigns/campaign-source";
import { CampaignDataContext } from "campaigns/context";
import IronVaultPlugin from "index";
import { MarkdownRenderChild } from "obsidian";
import renderAssetCard from "./asset-card";

export default function registerAssetBlock(plugin: IronVaultPlugin) {
  plugin.registerMarkdownCodeBlockProcessor(
    "iron-vault-asset",
    (source, el: HTMLElement, ctx) => {
      ctx.addChild(new AssetBlockRenderer(el, plugin, source, ctx.sourcePath));
    },
  );
}

class AssetBlockRenderer extends MarkdownRenderChild {
  campaignSource: FileBasedCampaignWatch;

  constructor(
    contentEl: HTMLElement,
    readonly plugin: IronVaultPlugin,
    readonly source: string,
    sourcePath: string,
  ) {
    super(contentEl);
    this.campaignSource = this.addChild(
      new FileBasedCampaignWatch(
        plugin.app.vault,
        plugin.campaignManager,
        sourcePath,
      ).onUpdate(() => this.render()),
    );
  }

  getAsset(dataContext: CampaignDataContext) {
    const trimmed = this.source.trim().toLowerCase();
    return (
      dataContext.assets.get(trimmed) ||
      [...dataContext.assets.values()].find(
        (a) => a.name.toLowerCase() === trimmed,
      )
    );
  }

  async render() {
    const dataContext = this.campaignSource.campaignContext;
    if (!dataContext) {
      render(
        html`<article class="error">
          Asset block may only be used within a campaign folder.
        </article>`,
        this.containerEl,
      );
      return;
    }
    const asset = this.getAsset(dataContext);
    if (!asset) {
      render(html`<p>No such asset: ${this.source}</p>`, this.containerEl);
      return;
    }
    render(
      renderAssetCard(this.plugin, dataContext, {
        id: asset._id,
        abilities: [true, false, false],
        options: {},
        controls: {},
      }),
      this.containerEl,
    );
  }
}
