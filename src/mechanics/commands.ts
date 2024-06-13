import { Editor } from "obsidian";

import { appendNodesToMoveOrMechanicsBlock } from "./editor";
import { createDetailsNode } from "./node-builders";
import { PromptModal } from "utils/ui/prompt";
import IronVaultPlugin from "index";
export async function insertComment(plugin: IronVaultPlugin, editor: Editor) {
  const comment = await PromptModal.prompt(plugin.app, "Enter your comment");
  appendNodesToMoveOrMechanicsBlock(editor, createDetailsNode(comment));
}
