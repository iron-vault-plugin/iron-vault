import { html, render } from "lit-html";
import { debounce, ItemView, WorkspaceLeaf } from "obsidian";

import { ActiveCampaignWatch } from "campaigns/campaign-source";
import IronVaultPlugin from "index";
import { rootLogger } from "logger";
import renderIronVaultCharacter from "./character";
import renderIronVaultMoves from "./moves";
import renderIronVaultOracles from "./oracles";

export const SIDEBAR_VIEW_TYPE = "iron-vault-sidebar-view";

const logger = rootLogger.getLogger("sidebar-view");

export class SidebarView extends ItemView {
  plugin: IronVaultPlugin;
  campaignSource: ActiveCampaignWatch;

  constructor(leaf: WorkspaceLeaf, plugin: IronVaultPlugin) {
    super(leaf);
    this.plugin = plugin;
    this.renderCharacter = debounce(this.renderCharacter.bind(this), 100, true);
    this.refresh = debounce(this.refresh.bind(this), 100, true);
    this.campaignSource = this.addChild(
      new ActiveCampaignWatch(plugin.campaignManager),
    ).onUpdate(() => this.refresh());
  }

  getViewType() {
    return SIDEBAR_VIEW_TYPE;
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

    this.registerEvent(
      this.plugin.campaignManager.on(
        "active-campaign-settings-changed",
        ({ key }) => {
          if (key === "activeCharacter") {
            this.renderCharacter();
          }
        },
      ),
    );

    this.registerEvent(
      // TODO: probably this should be limited to just the current character, although
      // how often would we change the non-active character?
      this.plugin.characters.on("changed", this.renderCharacter),
    );

    this.registerEvent(
      this.plugin.app.metadataCache.on("iron-vault:index-changed", () => {
        logger.trace("SidebarView: index changed");
        this.refresh();
      }),
    );

    this.refresh(true);
  }

  refresh(initial: boolean = false) {
    const dataContext = this.campaignSource.campaignContext;
    if (!initial && dataContext) {
      logger.trace("SidebarView.refresh: refreshing from context");
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
      this.renderCharacter();
    } else {
      logger.trace("SidebarView.refresh: no active campaign");
      render(
        html`No active campaign.`,
        this.contentEl.querySelector<HTMLElement>(".content.oracle-tab")!,
      );
      render(
        html`No active campaign.`,
        this.contentEl.querySelector<HTMLElement>(".content.move-tab")!,
      );
      render(
        html`No active campaign.`,
        this.contentEl.querySelector<HTMLElement>(".content.character-tab")!,
      );
    }
  }

  async onClose() {
    // Nothing to clean up.
  }

  renderCharacter() {
    logger.trace("SidebarView.renderCharacter: render character");
    renderIronVaultCharacter(
      this.contentEl.querySelector(".content.character-tab")!,
      this.plugin,
      this,
    );
  }
}
