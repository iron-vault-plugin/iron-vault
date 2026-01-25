/**
 * Inline mechanics module.
 * Provides inline rendering for moves, oracles, and progress rolls.
 */

import IronVaultPlugin from "index";
import { registerInlineProcessor } from "./processor";
import { inlineMechanicsPlugin } from "./live-preview";
import { MarkdownView } from "obsidian";

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
  diceRollToInlineSyntax,
  actionRollToInlineSyntax,
  rerollToInlineSyntax,
  oocToInlineSyntax,
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
 * Force all CodeMirror editors to rebuild their decorations.
 * This is needed when the hideMechanics setting changes.
 */
function refreshAllEditors(plugin: IronVaultPlugin): void {
  plugin.app.workspace.iterateAllLeaves((leaf) => {
    if (leaf.view instanceof MarkdownView) {
      const editor = leaf.view.editor;
      // Accessing internal CM6 editor
      const cmEditor = (
        editor as unknown as { cm?: { dispatch: (tr: object) => void } }
      )?.cm;
      if (cmEditor) {
        // Dispatch an empty transaction to trigger decoration rebuild
        cmEditor.dispatch({});
      }
    }
  });
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
        // Refresh all editors to rebuild decorations with new setting
        refreshAllEditors(plugin);
      }
    }),
  );
}
