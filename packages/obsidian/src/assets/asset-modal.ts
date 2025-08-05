import { html, render } from "lit-html";
import { App, Modal } from "obsidian";

import { Asset } from "@datasworn/core/dist/Datasworn";
import { addAssetToCharacter } from "characters/commands";
import { IDataContext } from "datastore/data-context";
import IronVaultPlugin from "index";
import renderAssetCard, { makeDefaultSheetAsset } from "./asset-card";

export class AssetModal extends Modal {
  constructor(
    app: App,
    readonly plugin: IronVaultPlugin,
    readonly dataContext: IDataContext,
    readonly asset: Asset,
  ) {
    super(app);
  }

  openAsset(asset: Asset) {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.toggleClass("iron-vault-modal-content", true);
    contentEl.toggleClass("iron-vault-asset-modal", true);
    contentEl.toggleClass("iron-vault-modal", true);
    render(
      html`
        ${renderAssetCard(
          this.plugin,
          this.dataContext,
          makeDefaultSheetAsset(asset),
        )}
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

  override onOpen() {
    this.openAsset(this.asset);
  }

  override onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}
