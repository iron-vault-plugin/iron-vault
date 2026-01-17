/**
 * Clock inline renderers.
 * Handles clock create, advance, and resolve operations.
 */

import IronVaultPlugin from "index";
import { setIcon } from "obsidian";
import {
  ParsedInlineClockCreate,
  ParsedInlineClockAdvance,
  ParsedInlineClockResolve,
} from "../syntax";
import { createContainer, createFileLink, setTooltip } from "./shared";

/**
 * Create a clickable link to a clock file.
 */
function createClockLink(
  name: string,
  path: string,
  plugin: IronVaultPlugin,
): HTMLSpanElement {
  return createFileLink(
    name,
    path,
    "iv-inline-clock-name",
    "data-clock-path",
    plugin,
  );
}

/**
 * Render an inline clock create.
 */
export function renderInlineClockCreate(
  parsed: ParsedInlineClockCreate,
  plugin: IronVaultPlugin,
): HTMLSpanElement {
  const container = createContainer("clock-create");

  // Icon indicator
  const iconEl = createSpan({ cls: "iv-inline-clock-icon" });
  setIcon(iconEl, "clock");
  container.appendChild(iconEl);

  // Clock name (clickable)
  container.appendChild(createClockLink(parsed.name, parsed.path, plugin));

  setTooltip(container, "Clock created");

  return container;
}

/**
 * Render an inline clock advance.
 */
export function renderInlineClockAdvance(
  parsed: ParsedInlineClockAdvance,
  plugin: IronVaultPlugin,
): HTMLSpanElement {
  // If there's an odds roll that failed, show it differently
  if (parsed.oddsRoll && parsed.oddsRoll.result === "No") {
    const container = createContainer("clock-advance-failed");

    // Icon indicator
    const iconEl = createSpan({ cls: "iv-inline-clock-icon" });
    setIcon(iconEl, "clock-arrow-up");
    container.appendChild(iconEl);

    // Clock name (clickable)
    container.appendChild(createClockLink(parsed.name, parsed.path, plugin));

    // Show current progress (no change)
    container.appendChild(
      createSpan({
        cls: "iv-inline-clock-progress",
        text: ` (${parsed.from}/${parsed.total})`,
      }),
    );

    // Show the failed odds roll with shortened format
    container.appendChild(
      createSpan({
        cls: "iv-inline-clock-odds-failed",
        text: ` ✗${parsed.oddsRoll.odds}`,
      }),
    );

    setTooltip(
      container,
      `Odds roll failed\n${parsed.oddsRoll.odds}: rolled ${parsed.oddsRoll.roll}`,
    );

    return container;
  }

  const container = createContainer("clock-advance");

  // Icon indicator
  const iconEl = createSpan({ cls: "iv-inline-clock-icon" });
  setIcon(iconEl, "clock-arrow-up");
  container.appendChild(iconEl);

  // Clock name (clickable)
  container.appendChild(createClockLink(parsed.name, parsed.path, plugin));

  // Progress indicator: +N (current/total)
  container.appendChild(
    createSpan({
      cls: "iv-inline-clock-progress",
      text: ` +${parsed.segments} (${parsed.to}/${parsed.total})`,
    }),
  );

  // If there's an odds roll that succeeded, show shortened format
  if (parsed.oddsRoll) {
    container.appendChild(
      createSpan({
        cls: "iv-inline-clock-odds-success",
        text: ` ✓${parsed.oddsRoll.odds}`,
      }),
    );
  }

  // Tooltip with details
  let tooltipText = `Segments: ${parsed.from} → ${parsed.to} (+${parsed.segments})`;
  if (parsed.oddsRoll) {
    tooltipText += `\n${parsed.oddsRoll.odds}: rolled ${parsed.oddsRoll.roll}`;
  }
  setTooltip(container, tooltipText);

  return container;
}

/**
 * Render an inline clock resolve.
 */
export function renderInlineClockResolve(
  parsed: ParsedInlineClockResolve,
  plugin: IronVaultPlugin,
): HTMLSpanElement {
  const container = createContainer("clock-resolve");

  // Icon indicator
  const iconEl = createSpan({ cls: "iv-inline-clock-icon" });
  setIcon(iconEl, "circle-check-big");
  container.appendChild(iconEl);

  // Clock name (clickable)
  container.appendChild(createClockLink(parsed.name, parsed.path, plugin));

  setTooltip(container, "Clock resolved");

  return container;
}
