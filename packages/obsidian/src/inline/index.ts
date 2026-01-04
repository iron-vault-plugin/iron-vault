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

const HIDE_MECHANICS_CLASS = "iv-hide-mechanics";

/**
 * Apply or remove the hide mechanics class based on settings.
 */
function updateHideMechanicsClass(enabled: boolean): void {
  if (enabled) {
    document.body.classList.add(HIDE_MECHANICS_CLASS);
  } else {
    document.body.classList.remove(HIDE_MECHANICS_CLASS);
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

  // Apply initial hide mechanics setting
  updateHideMechanicsClass(plugin.settings.hideMechanics);

  // Listen for hideMechanics setting changes
  plugin.register(
    plugin.settings.on("change", ({ key, newValue }) => {
      if (key === "hideMechanics") {
        updateHideMechanicsClass(newValue as boolean);
      }
    }),
  );
}
