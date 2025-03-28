import { UnsubscribeFunction } from "emittery";
import IronVaultPlugin from "index";
import { html, render } from "lit-html";
import { Component, debounce, MarkdownRenderChild, Vault } from "obsidian";
import { CampaignDataContext } from "./context";
import { CampaignFile } from "./entity";
import { CampaignManager } from "./manager";

import { rootLogger } from "logger";

const logger = rootLogger.getLogger("campaign-source");

/** A component that monitors either the file campaign or the active campaign.  */
abstract class BaseCampaignWatch extends Component {
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
    logger.trace("BaseCampaignSource: triggering update callback");
    return this.#onUpdate && this.#onUpdate();
  }
}

/** Campaign watcher that updates whenever the active campaign changes. */
export class ActiveCampaignWatch extends BaseCampaignWatch {
  constructor(readonly campaignManager: CampaignManager) {
    super();
  }

  onload() {
    logger.trace("ActiveCampaignWatch.onload: regstering watch");
    this.registerEvent(
      this.campaignManager.on("active-campaign-changed", () => this.update()),
    );

    if (this.campaignManager.lastActiveCampaign()) {
      logger.trace(
        "ActiveCampaignWatch.onload: found last active campaign; triggering update",
      );
      setTimeout(() => this.update());
    } else {
      logger.trace("ActiveCampaignWatch.onload: no active campaign");
    }
  }

  get campaign(): CampaignFile | undefined {
    return this.campaignManager.lastActiveCampaign();
  }

  get campaignContext(): CampaignDataContext | undefined {
    return this.campaignManager.lastActiveCampaignContext();
  }
}

/** Campaign watch that observes the campaign for the current file. */
export class FileBasedCampaignWatch extends BaseCampaignWatch {
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

  get sourcePath(): string {
    return this.#sourcePath;
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

/** Base class for markdown render children that depend on the campaign content.
 *
 * Calls subclass's render function when a campaign update is detected.
 * If a sourcePath is provided, will watch the file's assigned campaign. If no sourcePath
 * is provided, will watch for change to the active campaign.
 * */
export abstract class CampaignDependentBlockRenderer extends MarkdownRenderChild {
  campaignSource: BaseCampaignWatch;

  constructor(
    containerEl: HTMLElement,
    readonly plugin: IronVaultPlugin,
    sourcePath?: string,
    watchDataIndex: boolean = false,
    debouncePeriod: number = 0,
  ) {
    super(containerEl);

    const updater = debounce(() => this.update(), debouncePeriod, true);
    this.campaignSource = this.addChild(
      sourcePath
        ? new FileBasedCampaignWatch(
            plugin.app.vault,
            plugin.campaignManager,
            sourcePath,
          )
        : new ActiveCampaignWatch(plugin.campaignManager),
    ).onUpdate(() => void updater());
    if (watchDataIndex) {
      this.registerEvent(
        plugin.app.metadataCache.on(
          "iron-vault:index-changed",
          () => void updater(),
        ),
      );
    }
  }

  get campaign(): CampaignFile | undefined {
    return this.campaignSource.campaign;
  }

  get dataContext(): CampaignDataContext | undefined {
    return this.campaignSource.campaignContext;
  }

  get sourcePath(): string | undefined {
    return this.campaignSource instanceof FileBasedCampaignWatch
      ? this.campaignSource.sourcePath
      : undefined;
  }

  update(): void | Promise<void> {
    const context = this.dataContext;
    if (context) {
      return this.render(context);
    } else {
      return this.renderWithoutContext();
    }
  }

  abstract render(context: CampaignDataContext): void | Promise<void>;

  /** Override this to define what happens when no campaign data context is available. */
  renderWithoutContext(): void | Promise<void> {
    render(
      html`<article class="error">
        This block may only be used within a campaign.
      </article>`,
      this.containerEl,
    );
  }
}
