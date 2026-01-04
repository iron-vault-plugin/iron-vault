/**
 * Inline mechanics module.
 * Provides inline rendering for moves, oracles, and progress rolls.
 */

import IronVaultPlugin from "index";
import { registerInlineProcessor } from "./processor";
import { inlineMechanicsPlugin } from "./live-preview";

export {
  moveToInlineSyntax,
  oracleToInlineSyntax,
  progressToInlineSyntax,
  noRollToInlineSyntax,
  trackAdvanceToInlineSyntax,
  trackCreateToInlineSyntax,
  trackCompleteToInlineSyntax,
  trackReopenToInlineSyntax,
  clockCreateToInlineSyntax,
  clockAdvanceToInlineSyntax,
  clockResolveToInlineSyntax,
  meterToInlineSyntax,
  burnToInlineSyntax,
  initiativeToInlineSyntax,
  entityCreateToInlineSyntax,
  isInlineMechanics,
  parseInlineMechanics,
} from "./syntax";

export { insertInlineText } from "./editor-utils";

const WORD_WRAP_CLASS = "iv-inline-word-wrap";

/**
 * Apply or remove the word wrap class based on settings.
 */
function updateWordWrapClass(enabled: boolean): void {
  if (enabled) {
    document.body.classList.add(WORD_WRAP_CLASS);
  } else {
    document.body.classList.remove(WORD_WRAP_CLASS);
  }
}

/**
 * Register all inline mechanics handlers.
 */
export function registerInlineMechanics(plugin: IronVaultPlugin): void {
  // Register the post-processor for Reading View
  registerInlineProcessor(plugin);

  // Register the CodeMirror extension for Live Preview
  plugin.registerEditorExtension([inlineMechanicsPlugin(plugin)]);

  // Apply initial word wrap setting
  updateWordWrapClass(plugin.settings.inlineMechanicsWordWrap);

  // Listen for setting changes
  plugin.register(
    plugin.settings.on("change", ({ key, newValue }) => {
      if (key === "inlineMechanicsWordWrap") {
        updateWordWrapClass(newValue as boolean);
      }
    }),
  );
}
