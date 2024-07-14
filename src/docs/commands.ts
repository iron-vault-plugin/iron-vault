// This is largely taken from https://github.com/zorazrr/obsidian-link-opener
// and thus copyright Zora Zhang (@zorazrr), under the MIT license. See
// LICENSE.md for more details.
import IronVaultPlugin from "index";
import { IRON_VAULT_DOCS_URL, IronVaultLinkView } from "./docs-view";

export async function openDocsInTab(plugin: IronVaultPlugin) {
  await IronVaultLinkView.open(plugin.app);
}

export async function openDocsInBrowser() {
  window.open(IRON_VAULT_DOCS_URL, "_blank");
}
