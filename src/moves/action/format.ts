import { createOrAppendMechanics } from "mechanics/editor";
import { generateMechanicsNode } from "mechanics/node-builders";
import { Editor } from "obsidian";
import { MoveDescription } from "../desc";

export function renderMechanics(editor: Editor, move: MoveDescription): void {
  createOrAppendMechanics(editor, generateMechanicsNode(move));
}
