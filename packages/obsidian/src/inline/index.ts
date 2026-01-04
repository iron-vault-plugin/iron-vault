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

/**
 * Register all inline mechanics handlers.
 */
export function registerInlineMechanics(plugin: IronVaultPlugin): void {
  // Register the post-processor for Reading View
  registerInlineProcessor(plugin);

  // Register the CodeMirror extension for Live Preview
  plugin.registerEditorExtension([inlineMechanicsPlugin(plugin)]);
}
