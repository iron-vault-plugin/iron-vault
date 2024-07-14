// This is largely taken from https://github.com/zorazrr/obsidian-link-opener
// and thus copyright Zora Zhang (@zorazrr), under the MIT license. See
// LICENSE.md for more details.
import { App, ItemView, ViewStateResult, WorkspaceLeaf } from "obsidian";
export const LINK_VIEW = "iron-vault-link-view";
export const IRON_VAULT_DOCS_URL = "https://ironvault.quest";

export type LinkViewState = {
  link?: string;
};

export class IronVaultLinkView extends ItemView {
  link: string = IRON_VAULT_DOCS_URL;
  frame?: HTMLIFrameElement;

  static async open(app: App, link?: string): Promise<void> {
    const leaf = app.workspace.getLeaf("tab");
    await leaf.setViewState({
      type: LINK_VIEW,
      active: true,
      state: { link },
    });
    app.workspace.revealLeaf(leaf);
  }

  constructor(leaf: WorkspaceLeaf) {
    super(leaf);
  }

  getViewType() {
    return LINK_VIEW;
  }

  getDisplayText() {
    return "Iron Vault documentation";
  }

  async onOpen() {
    await super.onOpen();
    // We render after a moment to give time for a setState call to update the link.
    this.registerInterval(window.setTimeout(() => this.render()));
  }

  async onClose() {
    this.contentEl.empty();
    await super.onClose();
  }

  async render() {
    if (!this.frame) {
      console.log(
        "render-new-frame",
        this.getState(),
        this.getEphemeralState(),
      );
      const frame = (this.frame = this.contentEl.createEl("iframe"));
      frame.src = this.link;
      frame.setAttribute("frameborder", "0");
      frame.width = "100%";
      frame.height = "100%";
    } else {
      console.log(
        "render-existing-frame",
        this.getState(),
        this.getEphemeralState(),
      );
      this.frame.src = this.link;
    }
  }

  async setState(state: unknown, result: ViewStateResult): Promise<void> {
    if (
      typeof state === "object" &&
      typeof (state as Partial<LinkViewState>)?.link === "string"
    ) {
      this.link = (state as LinkViewState).link ?? IRON_VAULT_DOCS_URL;
      await this.render();
    }

    return await super.setState(state, result);
  }

  getState(): LinkViewState {
    return {
      link: this.link,
    };
  }
}
