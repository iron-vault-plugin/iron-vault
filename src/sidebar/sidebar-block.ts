import { CampaignDataContext } from "campaigns/context";
import { CampaignFile } from "campaigns/entity";
import { CampaignManager } from "campaigns/manager";
import { UnsubscribeFunction } from "emittery";
import IronVaultPlugin from "index";
import { html, render } from "lit-html";
import { Component, MarkdownRenderChild, Vault } from "obsidian";
import renderIronVaultMoves from "./moves";
import renderIronVaultOracles from "./oracles";

// These are intended for folks who want to get the stuff that's usualy in the
// sidebar, but embedded in a note directly.

export default function registerSidebarBlocks(plugin: IronVaultPlugin) {
  plugin.registerMarkdownCodeBlockProcessor(
    "iron-vault-moves",
    (_source, el: HTMLElement, ctx) => {
      ctx.addChild(new MovesRenderer(el, plugin, ctx.sourcePath));
    },
  );

  plugin.registerMarkdownCodeBlockProcessor(
    "iron-vault-oracles",
    (_source, el: HTMLElement, ctx) => {
      ctx.addChild(new OracleRenderer(el, plugin, ctx.sourcePath));
    },
  );
}

/** A component that monitors either the file campaign or the active campaign.  */
abstract class BaseCampaignSource extends Component {
  #onUpdate?: () => void | Promise<void>;

  constructor() {
    super();
  }

  abstract readonly campaign: CampaignFile | undefined;
  abstract readonly campaignContext: CampaignDataContext | undefined;

  onUpdate(callback: () => void | Promise<void>): this {
    this.#onUpdate = callback;
    return this;
  }

  protected update() {
    return this.#onUpdate && this.#onUpdate();
  }
}

export class ActiveCampaignWatch extends BaseCampaignSource {
  constructor(readonly campaignManager: CampaignManager) {
    super();
  }

  onload() {
    this.registerEvent(
      this.campaignManager.on("active-campaign-changed", () => this.update()),
    );

    if (this.campaignManager.lastActiveCampaign()) {
      setTimeout(() => this.update());
    }
  }

  get campaign(): CampaignFile | undefined {
    return this.campaignManager.lastActiveCampaign();
  }

  get campaignContext(): CampaignDataContext | undefined {
    return this.campaignManager.lastActiveCampaignContext();
  }
}

export class FileBasedCampaignWatch extends BaseCampaignSource {
  #sourcePath: string;

  #campaign?: CampaignFile;
  #unsub?: UnsubscribeFunction;

  constructor(
    private readonly vault: Vault,
    readonly campaignManager: CampaignManager,
    sourcePath: string,
  ) {
    super();

    this.#sourcePath = sourcePath;
  }

  get campaign(): CampaignFile | undefined {
    return this.#campaign;
  }

  get campaignContext(): CampaignDataContext | undefined {
    return (
      this.campaign && this.campaignManager.campaignContextFor(this.campaign)
    );
  }

  onload(): void {
    this.registerEvent(
      this.vault.on("rename", (file, oldPath) => {
        if (this.#sourcePath == oldPath) {
          this.#sourcePath = file.path;
          this.updateCampaign();
        }
      }),
    );
    this.updateCampaign();
  }

  private updateCampaign() {
    this.#unsub?.();

    const { campaign, unsubscribe } = this.campaignManager.watcher.watch(
      this.#sourcePath,
      () =>
        // Watch clears the watch, so this isn't weird.
        this.updateCampaign(),
    );
    this.#campaign = campaign ?? undefined;
    this.#unsub = unsubscribe;
    setTimeout(() => this.update());
  }

  onunload(): void {
    this.#unsub?.();
  }
}

abstract class CampaignDependentBlockRenderer extends MarkdownRenderChild {
  campaignSource: BaseCampaignSource;

  constructor(
    containerEl: HTMLElement,
    readonly plugin: IronVaultPlugin,
    sourcePath?: string,
  ) {
    super(containerEl);
    this.campaignSource = this.addChild(
      sourcePath
        ? new FileBasedCampaignWatch(
            plugin.app.vault,
            plugin.campaignManager,
            sourcePath,
          )
        : new ActiveCampaignWatch(plugin.campaignManager),
    ).onUpdate(() => this.update());
  }

  get campaign(): CampaignFile | undefined {
    return this.campaignSource.campaign;
  }

  get dataContext(): CampaignDataContext | undefined {
    return this.campaignSource.campaignContext;
  }

  update(): void | Promise<void> {
    const context = this.dataContext;
    if (context) {
      return this.render(context);
    } else {
      render(
        html`<article class="error">
          This block may only be used within a campaign.
        </article>`,
        this.containerEl,
      );
    }
  }

  abstract render(context: CampaignDataContext): void | Promise<void>;
}

class MovesRenderer extends CampaignDependentBlockRenderer {
  render(context: CampaignDataContext) {
    renderIronVaultMoves(this.containerEl, this.plugin, context);
  }
}

class OracleRenderer extends CampaignDependentBlockRenderer {
  render(context: CampaignDataContext) {
    renderIronVaultOracles(this.containerEl, this.plugin, context);
  }
}
