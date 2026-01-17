/**
 * Inline mechanics post-processor for Reading View.
 * Finds inline code elements with iv-* prefixes and replaces them with rendered results.
 */

import { MarkdownPostProcessorContext } from "obsidian";
import IronVaultPlugin from "index";
import { isInlineMechanics, parseInlineMechanics } from "./syntax";
import { renderParsedInline } from "./renderers/index";

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
  const codeElements = el.querySelectorAll("code");

  for (const code of Array.from(codeElements)) {
    const text = code.innerText.trim();

    if (!isInlineMechanics(text)) continue;

    const parsed = parseInlineMechanics(text);
    if (!parsed) continue;

    const rendered = renderParsedInline(parsed, plugin);
    code.replaceWith(rendered);
  }
}
