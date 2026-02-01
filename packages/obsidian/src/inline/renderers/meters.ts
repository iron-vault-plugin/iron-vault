/**
 * Meter-related inline renderers.
 * Handles meter changes, momentum burn, and initiative changes.
 */

import IronVaultPlugin from "index";
import { setIcon } from "obsidian";
import {
  ParsedInlineMeter,
  ParsedInlineBurn,
  ParsedInlineInitiative,
} from "../syntax";
import { createContainer, setTooltip } from "./shared";

/**
 * Render an inline meter change.
 */
export function renderInlineMeter(
  parsed: ParsedInlineMeter,
  _plugin: IronVaultPlugin,
): HTMLSpanElement {
  const delta = parsed.to - parsed.from;
  const isIncrease = delta > 0;
  const outcomeClass = isIncrease ? "meter-increase" : "meter-decrease";
  const container = createContainer(outcomeClass);

  // Meter icon (trending up or down based on change)
  const iconEl = createSpan({ cls: "iv-inline-meter-icon" });
  setIcon(iconEl, isIncrease ? "trending-up" : "trending-down");
  container.appendChild(iconEl);

  // Meter name
  container.appendChild(
    createSpan({ cls: "iv-inline-meter-name", text: parsed.name }),
  );

  // Change indicator
  container.appendChild(
    createSpan({
      cls: "iv-inline-meter-change",
      text: ` ${parsed.from}→${parsed.to}`,
    }),
  );

  // Tooltip
  const deltaStr = isIncrease ? `+${delta}` : `${delta}`;
  setTooltip(container, `${parsed.name}: ${deltaStr}`);

  return container;
}

/**
 * Render an inline momentum burn.
 */
export function renderInlineBurn(
  parsed: ParsedInlineBurn,
  _plugin: IronVaultPlugin,
): HTMLSpanElement {
  const container = createContainer("burn");

  // Burn icon (flame)
  const iconEl = createSpan({ cls: "iv-inline-burn-icon" });
  setIcon(iconEl, "flame");
  container.appendChild(iconEl);

  // Label
  container.appendChild(
    createSpan({ cls: "iv-inline-burn-label", text: "Burn" }),
  );

  // Change indicator
  container.appendChild(
    createSpan({
      cls: "iv-inline-burn-change",
      text: ` ${parsed.from}→${parsed.to}`,
    }),
  );

  setTooltip(container, `Burned momentum: ${parsed.from} → ${parsed.to}`);

  return container;
}

/**
 * Render an inline initiative change.
 */
export function renderInlineInitiative(
  parsed: ParsedInlineInitiative,
  _plugin: IronVaultPlugin,
): HTMLSpanElement {
  // Determine the initiative state class based on the "to" value
  const toValue = parsed.to?.toLowerCase();
  let stateClass = "initiative";
  if (toValue === "in control") {
    stateClass = "initiative-in-control";
  } else if (toValue === "in a bad spot") {
    stateClass = "initiative-bad-spot";
  } else if (toValue === "out of combat") {
    stateClass = "initiative-out-of-combat";
  }

  const container = createContainer(stateClass);

  // Initiative icon (footprints)
  const iconEl = createSpan({ cls: "iv-inline-initiative-icon" });
  setIcon(iconEl, "footprints");
  container.appendChild(iconEl);

  // Capitalize the "to" value for display
  const capitalizedTo = parsed.to
    ? parsed.to.charAt(0).toUpperCase() + parsed.to.slice(1)
    : undefined;

  // Label with colon
  container.appendChild(
    createSpan({ cls: "iv-inline-initiative-label", text: `${parsed.label}:` }),
  );

  // Show current state (just the "to" value)
  if (capitalizedTo) {
    container.appendChild(
      createSpan({ cls: "iv-inline-initiative-change", text: capitalizedTo }),
    );
  }

  // Tooltip shows the transition if we have both values
  let tooltipText = parsed.label;
  if (parsed.from && parsed.to) {
    tooltipText += `: ${parsed.from} → ${parsed.to}`;
  } else if (parsed.to) {
    tooltipText += `: ${parsed.to}`;
  }
  setTooltip(container, tooltipText);

  return container;
}
