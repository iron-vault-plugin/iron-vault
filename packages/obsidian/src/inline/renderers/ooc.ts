/**
 * OOC (Out-of-Character) comment inline renderer.
 */

import IronVaultPlugin from "index";
import { setIcon } from "obsidian";
import { ParsedInlineOOC } from "../syntax";
import { createContainer } from "./shared";

/**
 * Render an inline OOC comment.
 */
export function renderInlineOOC(
  parsed: ParsedInlineOOC,
  _plugin: IronVaultPlugin,
): HTMLSpanElement {
  const container = createContainer("ooc");

  // OOC icon (same style as no-roll)
  const iconEl = createSpan({ cls: "iv-inline-ooc-icon" });
  setIcon(iconEl, "message-square-more");
  container.appendChild(iconEl);

  // Comment text (italic, not a link)
  container.appendChild(
    createSpan({ cls: "iv-inline-ooc-text", text: parsed.text }),
  );

  return container;
}
