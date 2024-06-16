// This is largely taken from https://github.com/zorazrr/obsidian-link-opener
// and thus copyright Zora Zhang (@zorazrr), under the MIT license. See
// LICENSE.md for more details.
import IronVaultPlugin from "index";
import { IRON_VAULT_DOCS_URL, LINK_VIEW } from "./docs-view";

export async function openDocsInTab(plugin: IronVaultPlugin) {
  await plugin.app.workspace
    .getLeaf("tab")
    .setViewState({ type: LINK_VIEW, active: true });
  plugin.app.workspace.revealLeaf(
    plugin.app.workspace.getLeavesOfType(LINK_VIEW)[0],
  );
}

export async function openDocsInBrowser() {
  window.open(IRON_VAULT_DOCS_URL, "_blank");
}
