import { UnsubscribeFunction } from "emittery";
import IronVaultPlugin from "index";
import { html, render } from "lit-html";
import {
  Component,
  debounce,
  Debouncer,
  MarkdownRenderChild,
  Vault,
} from "obsidian";
import { CampaignDataContext } from "./context";
import { CampaignFile } from "./entity";
import { CampaignManager } from "./manager";

import { currentActiveCharacterForCampaign } from "character-tracker";
import {
  ActionContext,
  NoCharacterActionConext,
} from "characters/action-context";
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

  onunload(): void {
    this.#onUpdate = undefined;
    super.onunload();
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
    super.onunload();
  }
}

export interface CampaignRenderContext {
  get campaign(): CampaignFile;
  get dataContext(): CampaignDataContext;
  get actionContext(): ActionContext;
  get sourcePath(): string | undefined;
}

/** Base class for markdown render children that depend on the campaign content.
 *
 * Calls subclass's render function when a campaign update is detected.
 * If a sourcePath is provided, will watch the file's assigned campaign. If no sourcePath
 * is provided, will watch for change to the active campaign.
 * */
export abstract class CampaignDependentBlockRenderer extends MarkdownRenderChild {
  campaignSource: BaseCampaignWatch;
  triggerUpdate: Debouncer<[], void | Promise<void>>;

  constructor(
    containerEl: HTMLElement,
    readonly plugin: IronVaultPlugin,
    sourcePath?: string,
    watchDataIndex: boolean = false,
    debouncePeriod: number = 0,
  ) {
    super(containerEl);

    this.triggerUpdate = debounce(() => this.update(), debouncePeriod, true);
    this.campaignSource = this.addChild(
      sourcePath
        ? new FileBasedCampaignWatch(
            plugin.app.vault,
            plugin.campaignManager,
            sourcePath,
          )
        : new ActiveCampaignWatch(plugin.campaignManager),
    ).onUpdate(() => void this.triggerUpdate());

    if (watchDataIndex) {
      this.registerEvent(
        plugin.app.metadataCache.on(
          "iron-vault:index-changed",
          () => void this.triggerUpdate(),
        ),
      );
    }
  }

  get campaign(): CampaignFile {
    if (!this.campaignSource.campaign) {
      throw new Error(
        "Unexpected call to get campaign without a campaign context.",
      );
    }
    return this.campaignSource.campaign;
  }

  get dataContext(): CampaignDataContext {
    if (!this.campaignSource.campaignContext) {
      throw new Error(
        "Unexpected call to get campaignContext without a campaign context.",
      );
    }
    return this.campaignSource.campaignContext;
  }

  get actionContext(): ActionContext {
    if (this.dataContext instanceof CampaignDataContext) {
      return (
        currentActiveCharacterForCampaign(
          this.plugin,
          this.dataContext,
          true,
        ) ?? new NoCharacterActionConext(this.dataContext)
      );
    }

    throw new Error(
      "Unexpected call to get actionContext without a campaign context.",
    );
  }

  get sourcePath(): string | undefined {
    return this.campaignSource instanceof FileBasedCampaignWatch
      ? this.campaignSource.sourcePath
      : undefined;
  }

  /** Override this to provide special handling of new contexts */
  protected onNewContext(_context: CampaignDataContext | undefined): void {}

  update(): void | Promise<void> {
    const context = this.campaignSource.campaignContext;
    if (context) {
      this.onNewContext(context);
      return this.render();
    } else {
      return this.renderWithoutContext();
    }
  }

  /** Your implementation of rendering. Within here, you should be guaranteed that the
   * campaign, dataContext, and actionContext are available.
   */
  abstract render(): void | Promise<void>;

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
