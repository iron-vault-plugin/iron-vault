// This is largely taken from https://github.com/zorazrr/obsidian-link-opener
// and thus copyright Zora Zhang (@zorazrr), under the MIT license. See
// LICENSE.md for more details.
import { ItemView, Workspace, WorkspaceLeaf } from "obsidian";
export const LINK_VIEW = "iron-vault-link-view";
export const IRON_VAULT_DOCS_URL =
  "https://iron-vault-plugin.github.io/iron-vault";

export class IronVaultLinkView extends ItemView {
  link: string;
  workspace: Workspace;

  constructor(
    workspace: Workspace,
    leaf: WorkspaceLeaf,
    link: string = IRON_VAULT_DOCS_URL,
  ) {
    super(leaf);
    this.workspace = workspace;
    this.link = link;
  }

  getViewType() {
    return LINK_VIEW;
  }

  getDisplayText() {
    return "Iron Vault Documentation";
  }

  setLink(link: string) {
    this.link = link;
  }

  async onOpen() {
    const container = this.containerEl.children[1];
    container.empty();
    const frame = container.createEl("iframe");
    frame.src = this.link;
    frame.setAttribute("frameborder", "0");
    frame.width = "100%";
    frame.height = "100%";
  }

  async onClose() {}
}
