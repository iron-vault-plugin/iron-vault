import { Editor, MarkdownFileInfo, MarkdownView } from "obsidian";

import IronVaultPlugin from "index";
import { replaceLinks } from "./migration-0_0_10-0_1_0";

export async function migrateFileCommand(
  plugin: IronVaultPlugin,
  editor: Editor,
  ctx: MarkdownView | MarkdownFileInfo,
) {
  plugin.app.vault.process(ctx.file!, (data) => replaceLinks(data));
}
