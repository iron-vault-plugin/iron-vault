/**
 * Inline mechanics post-processor for Reading View.
 * Finds inline code elements with iv-move:, iv-oracle:, or iv-progress: prefixes
 * and replaces them with rendered results.
 */

import { MarkdownPostProcessorContext } from "obsidian";
import IronVaultPlugin from "index";
import {
  isInlineMechanics,
  parseMoveInline,
  parseOracleInline,
  parseProgressInline,
  parseNoRollInline,
} from "./syntax";
import {
  renderInlineMove,
  renderInlineOracle,
  renderInlineProgress,
  renderInlineNoRoll,
} from "./renderers";

/**
 * Register the inline mechanics post-processor.
 */
export function registerInlineProcessor(plugin: IronVaultPlugin): void {
  plugin.registerMarkdownPostProcessor(
    (el: HTMLElement, ctx: MarkdownPostProcessorContext) => {
      processInlineMechanics(el, plugin, ctx);
    },
  );
}

/**
 * Process inline mechanics in an element.
 */
function processInlineMechanics(
  el: HTMLElement,
  plugin: IronVaultPlugin,
  _ctx: MarkdownPostProcessorContext,
): void {
  // Find all code elements
  const codeElements = el.querySelectorAll("code");

  for (const code of Array.from(codeElements)) {
    const text = code.innerText.trim();

    // Skip if not inline mechanics
    if (!isInlineMechanics(text)) continue;

    // Try to parse and render move
    const moveData = parseMoveInline(text);
    if (moveData) {
      const rendered = renderInlineMove(moveData, plugin);
      code.replaceWith(rendered);
      continue;
    }

    // Try to parse and render oracle
    const oracleData = parseOracleInline(text);
    if (oracleData) {
      const rendered = renderInlineOracle(oracleData, plugin);
      code.replaceWith(rendered);
      continue;
    }

    // Try to parse and render progress
    const progressData = parseProgressInline(text);
    if (progressData) {
      const rendered = renderInlineProgress(progressData, plugin);
      code.replaceWith(rendered);
      continue;
    }

    // Try to parse and render no-roll move
    const noRollData = parseNoRollInline(text);
    if (noRollData) {
      const rendered = renderInlineNoRoll(noRollData, plugin);
      code.replaceWith(rendered);
      continue;
    }
  }
}
