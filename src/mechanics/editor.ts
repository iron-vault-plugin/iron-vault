import * as kdl from "kdljs";
import { Editor, EditorRange } from "obsidian";
import { findAdjacentCodeBlock, reverseLineIterator } from "../utils/editor";

export const MECHANICS_CODE_BLOCK_TAG = "mechanics";

/** Adds nodes to an existing mechanics block. */
export function createOrAppendMechanics(
  editor: Editor,
  newItems: kdl.Node[],
): void {
  // TODO: right now, if something is selected, we just replace it, and skip the block merging logic. Should we do something else?
  let existingBlockRange: EditorRange | null = null;
  if (!editor.somethingSelected()) {
    existingBlockRange = findAdjacentCodeBlock(
      reverseLineIterator(editor, editor.getCursor()),
      MECHANICS_CODE_BLOCK_TAG,
    );
  }

  const newNodeLines = kdl.format(newItems);

  if (existingBlockRange) {
    // Insert additional nodes at the end of the existing block
    editor.replaceRange(`${newNodeLines}\n`, {
      line: existingBlockRange.to.line - 1,
      ch: 0,
    });
  } else {
    const extraLine = editor.getCursor("from").ch > 0 ? "\n\n" : "";
    editor.replaceSelection(
      `${extraLine}\`\`\`${MECHANICS_CODE_BLOCK_TAG}\n${newNodeLines}\`\`\`\n\n`,
    );
  }
}
