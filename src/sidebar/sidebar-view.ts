import { html, render } from "lit-html";
import { ItemView, WorkspaceLeaf } from "obsidian";

import IronVaultPlugin from "index";
import renderIronVaultCharacter from "./character";
import renderIronVaultMoves from "./moves";
import renderIronVaultOracles from "./oracles";

export const VIEW_TYPE = "iron-vault-sidebar-view";

export class SidebarView extends ItemView {
  plugin: IronVaultPlugin;

  constructor(leaf: WorkspaceLeaf, plugin: IronVaultPlugin) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType() {
    return VIEW_TYPE;
  }

  getDisplayText() {
    return "Iron Vault";
  }

  getIcon() {
    return "dice";
  }

  async onOpen() {
    const container = this.containerEl.children[1];
    container.empty();
    const tpl = html`
      <nav class="iron-vault-sidebar-view tabs">
        <div class="tab">
          <input type="radio" name="tab-group" id="oracle-tab" checked />
          <label for="oracle-tab">Oracles</label>
          <div class="content oracle-tab"></div>
        </div>
        <div class="tab">
          <input type="radio" name="tab-group" id="move-tab" />
          <label for="move-tab">Moves</label>
          <div class="content move-tab"></div>
        </div>
        <div class="tab">
          <input type="radio" name="tab-group" id="character-tab" />
          <label for="character-tab">Character</label>
          <div class="content character-tab"></div>
        </div>
      </nav>
    `;
    render(tpl, container as HTMLElement);
    // We separate these out so they can do their own dynamic state stuff.
    renderIronVaultOracles(
      container.querySelector(".content.oracle-tab")!,
      this.plugin,
    );
    renderIronVaultMoves(
      container.querySelector(".content.move-tab")!,
      this.plugin,
    );

    this.registerEvent(
      this.plugin.characters.on("changed", () => {
        renderIronVaultCharacter(
          container.querySelector(".content.character-tab")!,
          this.plugin,
          this,
        );
      }),
    );
  }

  async onClose() {
    // Nothing to clean up.
  }
}
