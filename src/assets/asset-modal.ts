import { html, render } from "lit-html";
import { App, Modal } from "obsidian";

import { Asset } from "@datasworn/core/dist/Datasworn";
import IronVaultPlugin from "index";
import renderAssetCard from "./asset-card";
import { addAssetToCharacter } from "characters/commands";

export class AssetModal extends Modal {
  plugin: IronVaultPlugin;
  asset: Asset;

  constructor(app: App, plugin: IronVaultPlugin, asset: Asset) {
    super(app);
    this.plugin = plugin;
    this.asset = asset;
  }

  openAsset(asset: Asset) {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.toggleClass("iron-vault-modal-content", true);
    contentEl.toggleClass("iron-vault-asset-modal", true);
    contentEl.toggleClass("iron-vault-modal", true);
    render(
      html`
        ${renderAssetCard(this.plugin, {
          id: asset._id,
          abilities: [true, false, false],
          options: {},
          controls: {},
        })}
        <button
          type="button"
          @click=${() => {
            addAssetToCharacter(this.plugin, undefined, undefined, asset);
            this.close();
          }}
        >
          Add Asset to Character
        </button>
      `,
      contentEl,
    );
  }

  onOpen() {
    this.openAsset(this.asset);
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}
