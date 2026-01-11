/**
 * Entity inline renderer.
 */

import IronVaultPlugin from "index";
import { setIcon } from "obsidian";
import { ParsedInlineEntityCreate } from "../syntax";
import { createContainer, createFileLink, setTooltip } from "./shared";

/**
 * Render an inline entity create.
 */
export function renderInlineEntityCreate(
  parsed: ParsedInlineEntityCreate,
  plugin: IronVaultPlugin,
): HTMLSpanElement {
  const container = createContainer("entity-create");

  // Icon indicator
  const iconEl = createSpan({ cls: "iv-inline-entity-icon" });
  setIcon(iconEl, "file-plus");
  container.appendChild(iconEl);

  // Entity type label
  container.appendChild(
    createSpan({ cls: "iv-inline-entity-type", text: `${parsed.entityType}:` }),
  );

  // Entity name (clickable)
  container.appendChild(
    createFileLink(
      parsed.name,
      parsed.path,
      "iv-inline-entity-name",
      "data-entity-path",
      plugin,
    ),
  );

  setTooltip(container, `${parsed.entityType} created`);

  return container;
}
