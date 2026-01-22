import { createNewCampaignCommand } from "campaigns/commands";
import { IronVaultLinkView } from "docs/docs-view";
import IronVaultPlugin from "index";
import { html, render } from "lit-html";
import { App, IconName, ItemView, WorkspaceLeaf } from "obsidian";

export const ONBOARDING_VIEW_TYPE = "iron-vault-onboarding";

export async function checkForOnboarding(
  plugin: IronVaultPlugin,
): Promise<void> {
  await updateOnboardingViewState(plugin.app, plugin.campaigns.size == 0);
}

export async function updateOnboardingViewState(
  app: App,
  show: boolean,
): Promise<void> {
  const { workspace } = app;

  let leaf: WorkspaceLeaf | null = null;
  const leaves = workspace.getLeavesOfType(ONBOARDING_VIEW_TYPE);

  if (leaves.length > 0) {
    // A leaf with our view already exists, use that
    leaf = leaves[0];

    if (show) {
      (leaf.view as OnboardingView).render();
    } else {
      leaf.detach();
      leaf = null;
    }
  } else if (show) {
    // Our view could not be found in the workspace, create a new leaf
    // in the right sidebar for it
    leaf = workspace.getLeaf(true);
    await leaf.setViewState({ type: ONBOARDING_VIEW_TYPE, active: true });
  }

  // "Reveal" the leaf in case it is in a collapsed sidebar
  if (leaf && show) workspace.revealLeaf(leaf);
}

export class OnboardingView extends ItemView {
  override readonly navigation: boolean = false;

  readonly DATA_EXPLAINER = html`
    <h2>Included Datasets</h2>

    <p>
      Iron Vault includes data from various official and community rulesets and
      expansions. This data has been generously made available for free to
      community tools by their respective authors, allowing you to use Iron
      Vault without paying. You can control which datasets are activated in the
      playset settings page for your campaign.
    </p>

    <p>
      We ask that, if you haven't already, you consider buying the source books
      for these rulesets and expansions when you decide to play with them in
      your campaign, in order to support the game creators that make this
      experience possible:
      <ul>
        <li>[Ironsworn](https://tomkinpress.com/collections/products-for-ironsworn) ([CC-BY-4.0](https://creativecommons.org/licenses/by/4.0))</li>
        <li>[Ironsworn: Delve](https://tomkinpress.com/collections/products-for-ironsworn-delve) ([CC-BY-4.0](https://creativecommons.org/licenses/by/4.0))</li>
        <li>[Ironsworn: Starforged](https://tomkinpress.com/collections/products-for-ironsworn-starforged) ([CC-BY-4.0](https://creativecommons.org/licenses/by/4.0))</li>
        <li>[Sundered Isled](https://tomkinpress.com/collections/products-for-sundered-isles) ([CC-BY-NC-SA-4.0](https://creativecommons.org/licenses/by-nc-sa/4.0))</li>
        <li>[Ancient Wonders](https://ludicpen.itch.io/ancient-wonders) ([Print-on-demand](https://www.drivethrurpg.com/product/505365)) ([CC-BY-NC-SA-4.0](https://creativecommons.org/licenses/by-nc-sa/4.0))</li>
        <li>[Fe-Runners](https://zombiecraig.itch.io/fe-runners) ([CC-BY-NC-SA-4.0](https://creativecommons.org/licenses/by-nc-sa/4.0))</li>
        <li>[Starsmith Expanded Oracles](https://playeveryrole.com/starsmith-products/) ([CC-BY-4.0](https://creativecommons.org/licenses/by/4.0))</li>
      </ul>
    </p>
  `;

  readonly CAMPAIGN_EXPLAINER = html`
    <h2>What is a campaign?</h2>

    <p>
      A campaign is a folder with a <em>campaign index file</em> in its root.
      All tracked entities for a campaign, such as player characters, progress
      tracks, and clocks, must exist in the campaign root folder or one of its
      subfolders.
    </p>
  `;

  readonly NEW_USER_WELCOME_MESSAGE = html`
    <h1>Welcome to Iron Vault!</h1>

    <p>
      We noticed that your vault does not seem to have been used with Iron Vault
      before.
    </p>

    <p>
      If this is your first time using Iron Vault, we encourage you to
      <a @click="${this._docLinkClickHandler.bind(this)}"
        >read the documentation</a
      >. In particular, the
      <a
        @click="${this._docLinkClickHandler.bind(this)}"
        data-doc-link="https://ironvault.quest/player's-guide/getting-started/01-initial-setup.html"
        >Getting started guide</a
      >
      will walk you through the main features of this plugin.
    </p>

    <p>
      Before you can begin, you'll need to
      <a @click="${this._createCampaignClickHandler.bind(this)}"
        >create a campaign</a
      >.
    </p>

    <ul>
      <li>
        <strong>If you only plan to use this vault for a single campaign</strong
        >, create your new campaign at the root of your vault. (write the folder
        name as "/")
      </li>

      <li>
        <strong>If you wish to play multiple campaigns in this vault</strong>,
        create your new campaign in a subfolder. This is the default as you pick
        a name for your campaign.
      </li>
    </ul>

    ${this.DATA_EXPLAINER} ${this.CAMPAIGN_EXPLAINER}
  `;

  readonly EXISTING_USER_WELCOME_MESSAGE = html`
    <h1>Welcome back to Iron Vault!</h1>

    <p>
      It looks like your vault is from a previous version of Iron Vault. Iron
      Vault now requires that all vaults have a campaign index file.
    </p>

    <p>
      Your vault does not contain any campaign index files, and you must create
      one in order to resume your campaign. Use the
      <a @click="${this._createCampaignClickHandler.bind(this)}"
        >create a campaign</a
      >
      command to do so.
    </p>

    <ul>
      <li>
        <strong
          >If your vault only has a single campaign and you want to keep it that
          way</strong
        >, the easiest thing to do is put a new campaign in the root folder of
        your vault (set the folder as "/"). All of your existing content will be
        detected as being part of that campaign, and you can continue as before.
      </li>

      <li>
        <strong
          >If your vault contains multiple campaigns (or you wish to in the
          future)</strong
        >, you'll want to organize your vault with a folder for each campaign.
        Once the folders are created,
        <a @click="${this._createCampaignClickHandler.bind(this)}"
          >create a campaign</a
        >
        in each folder.
      </li>
    </ul>

    <p>
      If you decide to make this a single-campaign vault and change your mind
      later, simply move all your campaign files and folders inside a new
      folder, and your "root" campaign will be moved there.
    </p>

    ${this.DATA_EXPLAINER} ${this.CAMPAIGN_EXPLAINER}
  `;

  constructor(
    leaf: WorkspaceLeaf,
    readonly plugin: IronVaultPlugin,
  ) {
    super(leaf);
  }

  getViewType() {
    return ONBOARDING_VIEW_TYPE;
  }

  override getIcon(): IconName {
    return "iron-vault";
  }

  getDisplayText() {
    return "Welcome to Iron Vault!";
  }

  override async onOpen() {
    this.contentEl.addClass("iron-vault-onboarding-view");
    this.render();
  }

  render() {
    render(
      this.plugin.characters.size > 0
        ? this.EXISTING_USER_WELCOME_MESSAGE
        : this.NEW_USER_WELCOME_MESSAGE,
      this.contentEl,
    );
  }

  private _docLinkClickHandler(e: Event) {
    e.preventDefault();
    e.stopPropagation();
    const link = (e.target as HTMLAnchorElement).dataset.docLink;
    IronVaultLinkView.open(this.app, link);
  }

  private _createCampaignClickHandler(e: Event) {
    e.preventDefault();
    e.stopPropagation();
    createNewCampaignCommand(this.plugin);
  }

  override async onClose() {
    // Nothing to clean up.
  }
}
