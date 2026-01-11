/**
 * Track inline renderers.
 * Handles track advance, create, complete, and reopen operations.
 */

import IronVaultPlugin from "index";
import { setIcon } from "obsidian";
import {
  ParsedInlineTrackAdvance,
  ParsedInlineTrackCreate,
  ParsedInlineTrackComplete,
  ParsedInlineTrackReopen,
} from "../syntax";
import { createContainer, createFileLink, setTooltip } from "./shared";

/**
 * Create a clickable link to a track file.
 */
function createTrackLink(
  name: string,
  path: string,
  plugin: IronVaultPlugin,
): HTMLSpanElement {
  return createFileLink(
    name,
    path,
    "iv-inline-track-name",
    "data-track-path",
    plugin,
  );
}

/**
 * Render an inline track advance.
 */
export function renderInlineTrackAdvance(
  parsed: ParsedInlineTrackAdvance,
  plugin: IronVaultPlugin,
): HTMLSpanElement {
  const container = createContainer("track-advance");

  // Icon indicator
  const iconEl = createSpan({ cls: "iv-inline-track-icon" });
  setIcon(iconEl, "copy-check");
  container.appendChild(iconEl);

  // Track name (clickable)
  container.appendChild(createTrackLink(parsed.name, parsed.path, plugin));

  // Progress indicator: +N (boxes/10)
  const filledBoxes = Math.floor(parsed.to / 4);
  container.appendChild(
    createSpan({
      cls: "iv-inline-track-progress",
      text: ` +${parsed.steps} (${filledBoxes}/10)`,
    }),
  );

  // Tooltip with details
  const fromBoxes = Math.floor(parsed.from / 4);
  setTooltip(
    container,
    `Progress: ${fromBoxes} → ${filledBoxes} boxes\nRank: ${parsed.rank}\nSteps: ${parsed.steps}`,
  );

  return container;
}

/**
 * Render an inline track create.
 */
export function renderInlineTrackCreate(
  parsed: ParsedInlineTrackCreate,
  plugin: IronVaultPlugin,
): HTMLSpanElement {
  const container = createContainer("track-create");

  // Icon indicator
  const iconEl = createSpan({ cls: "iv-inline-track-icon" });
  setIcon(iconEl, "square-stack");
  container.appendChild(iconEl);

  // Track name (clickable)
  container.appendChild(createTrackLink(parsed.name, parsed.path, plugin));

  setTooltip(container, "Track created");

  return container;
}

/**
 * Render an inline track complete.
 */
export function renderInlineTrackComplete(
  parsed: ParsedInlineTrackComplete,
  plugin: IronVaultPlugin,
): HTMLSpanElement {
  const container = createContainer("track-complete");

  // Icon indicator
  const iconEl = createSpan({ cls: "iv-inline-track-icon" });
  setIcon(iconEl, "square-check-big");
  container.appendChild(iconEl);

  // Track name (clickable)
  container.appendChild(createTrackLink(parsed.name, parsed.path, plugin));

  setTooltip(container, "Track completed");

  return container;
}

/**
 * Render an inline track reopen.
 */
export function renderInlineTrackReopen(
  parsed: ParsedInlineTrackReopen,
  plugin: IronVaultPlugin,
): HTMLSpanElement {
  const container = createContainer("track-reopen");

  // Icon indicator
  const iconEl = createSpan({ cls: "iv-inline-track-icon" });
  setIcon(iconEl, "rotate-ccw");
  container.appendChild(iconEl);

  // Track name (clickable)
  container.appendChild(createTrackLink(parsed.name, parsed.path, plugin));

  setTooltip(container, "Track reopened");

  return container;
}
