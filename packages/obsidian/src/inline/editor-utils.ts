/**
 * Editor utilities for inline mechanics.
 */

import { Editor } from "obsidian";

/**
 * Insert inline text at cursor with proper spacing.
 *
 * Adds a leading space if the cursor is not at the start of a line,
 * and always adds a trailing space after the text.
 */
export function insertInlineText(editor: Editor, text: string): void {
  const extraSpace = editor.getCursor("from").ch > 0 ? " " : "";
  editor.replaceSelection(`${extraSpace}${text} `);
}
