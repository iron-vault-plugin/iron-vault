import { CampaignInput } from "campaigns/entity";
import IronVaultPlugin from "index";
import { onlyInvalid } from "indexer/index-impl";
import { html, render, TemplateResult } from "lit-html";
import { map } from "lit-html/directives/map.js";
import { App, debounce, IconName, ItemView, WorkspaceLeaf } from "obsidian";
import { showSingletonView } from "utils/obsidian";
import { ZodError } from "zod";
import { CampaignEditView } from "./edit-view";

export const INVALID_CAMPAIGNS_VIEW_TYPE = "iron-vault-invalid-campaigns";

export class InvalidCampaignsView extends ItemView {
  readonly navigation: boolean = false;

  static async showIfNeeded(plugin: IronVaultPlugin): Promise<void> {
    if (onlyInvalid(plugin.campaigns).size > 0) {
      await this.show(plugin.app);
    }
  }

  static show(app: App): Promise<void> {
    return showSingletonView(app, INVALID_CAMPAIGNS_VIEW_TYPE);
  }

  constructor(
    leaf: WorkspaceLeaf,
    readonly plugin: IronVaultPlugin,
  ) {
    super(leaf);
    this.contentEl.addClass("iv-base-view", "iv-invalid-campaigns-view");
    this.render = debounce(this.render.bind(this), 100, true);
  }

  getViewType(): string {
    return INVALID_CAMPAIGNS_VIEW_TYPE;
  }

  getDisplayText(): string {
    return "Iron Vault: Fix invalid campaigns";
  }

  getIcon(): IconName {
    return "iron-vault";
  }

  onload(): void {
    super.onload();
    this.registerEvent(this.plugin.campaigns.on("changed", this.render));
  }

  protected async onOpen(): Promise<void> {
    this.render();
  }

  protected render() {
    const invalid = onlyInvalid(this.plugin.campaigns);
    if (invalid.size == 0) {
      render(
        html`<p>
          Congratulations. Your campaigns are all ready to go. You can close
          this window at your leisure.
        </p>`,
        this.contentEl,
      );
    } else {
      render(
        html`
          <p>
            Iron vault detected that the following campaigns have errors that
            must be resolved before you can use them:
          </p>
          <dl>
            ${map(
              onlyInvalid(this.plugin.campaigns),
              ([k, e]) =>
                html`<dt>${k}</dt>
                  <dd>${this.reason(k, e)}</dd>`,
            )}
          </dl>
        `,
        this.contentEl,
      );
    }
  }

  protected reason(path: string, error: Error): TemplateResult {
    if (error instanceof ZodError) {
      const validationErrors = (error as ZodError<CampaignInput>).format();
      if (
        validationErrors.ironvault?._errors &&
        validationErrors.ironvault._errors.includes("Required")
      ) {
        return html`Campaign is from a previous version of Ironvault. We now
          require campaigns to define a "playset".
          <a data-campaign-path="${path}" @click=${this.openCampaign.bind(this)}
            >Use the campaign editor to add a playset.</a
          >`;
      } else if (
        validationErrors.ironvault?.playset?._errors &&
        validationErrors.ironvault.playset._errors.length > 0
      ) {
        return html`Playset is invalid or missing.
          <a data-campaign-path="${path}" @click=${this.openCampaign.bind(this)}
            >Use the campaign editor to add a playset.</a
          >: ${validationErrors.ironvault.playset._errors.join("; ")}`;
      } else {
        return html`Campaign is invalid:
          <pre>${validationErrors}</pre>`;
      }
    } else {
      return html`Unexpected error:
        <pre>${error}</pre>`;
    }
  }

  async openCampaign(ev: MouseEvent) {
    const path = (ev.target as HTMLElement).dataset.campaignPath;
    if (path) {
      await CampaignEditView.openFile(this.app, path);
    }
  }
}
