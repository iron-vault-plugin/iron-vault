import { html, render } from "lit-html";
import { debounce, ItemView, WorkspaceLeaf } from "obsidian";

import IronVaultPlugin from "index";
import renderIronVaultCharacter from "./character";
import renderIronVaultMoves from "./moves";
import renderIronVaultOracles from "./oracles";
import { ActiveCampaignWatch } from "./sidebar-block";

export const VIEW_TYPE = "iron-vault-sidebar-view";

export class SidebarView extends ItemView {
  plugin: IronVaultPlugin;
  campaignSource: ActiveCampaignWatch;

  constructor(leaf: WorkspaceLeaf, plugin: IronVaultPlugin) {
    super(leaf);
    this.plugin = plugin;
    this.campaignSource = this.addChild(
      new ActiveCampaignWatch(plugin.campaignManager),
    ).onUpdate(() => this.refresh());
  }

  getViewType() {
    return VIEW_TYPE;
  }

  getDisplayText() {
    return "Iron Vault";
  }

  getIcon() {
    return "iron-vault";
  }

  async onOpen() {
    this.contentEl.empty();
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
    render(tpl, this.contentEl);

    // We separate these out so they can do their own dynamic state stuff.
    const renderCharacter = debounce(() => this.renderCharacter(), 100, true);

    this.registerEvent(
      this.plugin.campaignManager.on("active-campaign-changed", () => {
        renderCharacter();
      }),
    );

    this.registerEvent(
      this.plugin.campaignManager.on(
        "active-campaign-settings-changed",
        ({ key }) => {
          if (key === "activeCharacter") {
            renderCharacter();
          }
        },
      ),
    );

    this.registerEvent(this.plugin.characters.on("changed", renderCharacter));

    this.refresh();
  }

  refresh() {
    const dataContext = this.campaignSource.dataContext;
    if (dataContext) {
      renderIronVaultOracles(
        this.contentEl.querySelector(".content.oracle-tab")!,
        this.plugin,
        dataContext,
      );
      renderIronVaultMoves(
        this.contentEl.querySelector(".content.move-tab")!,
        this.plugin,
        dataContext,
      );
    } else {
      // I guess render something else?
    }
  }

  async onClose() {
    // Nothing to clean up.
  }

  renderCharacter() {
    renderIronVaultCharacter(
      this.contentEl.querySelector(".content.character-tab")!,
      this.plugin,
      this,
    );
  }
}
