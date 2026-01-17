/**
 * Move-related inline renderers.
 * Handles action moves, progress rolls, and no-roll moves.
 */

import IronVaultPlugin from "index";
import { setIcon } from "obsidian";
import {
  ParsedInlineMove,
  ParsedInlineProgress,
  ParsedInlineNoRoll,
  determineOutcome,
  outcomeText,
  formatAddsForDisplay,
} from "../syntax";
import { createContainer, createMoveNameLink, setTooltip } from "./shared";

/**
 * Render an inline move result.
 */
export function renderInlineMove(
  parsed: ParsedInlineMove,
  plugin: IronVaultPlugin,
): HTMLSpanElement {
  // Calculate the original score (before burn)
  const originalScore = Math.min(
    10,
    parsed.action + parsed.statVal + parsed.adds,
  );

  // If burn was used, the effective score is the burn.orig (momentum value)
  const effectiveScore = parsed.burn ? parsed.burn.orig : originalScore;

  // Determine outcome based on effective score
  const { outcome, match } = determineOutcome(
    effectiveScore,
    parsed.vs1,
    parsed.vs2,
  );

  const outcomeClass = match ? `${outcome} match` : outcome;
  const container = createContainer(outcomeClass);

  // Outcome icon (first for immediate visual feedback)
  container.appendChild(createSpan({ cls: "iv-inline-outcome-icon" }));

  // Move name (clickable if we have a moveId)
  container.appendChild(createMoveNameLink(parsed.name, parsed.moveId, plugin));

  // Stat (in parentheses)
  container.appendChild(
    createSpan({ cls: "iv-inline-stat", text: `(${parsed.stat})` }),
  );

  // Separator
  container.appendChild(createSpan({ cls: "iv-inline-separator", text: "—" }));

  // Burn indicator (flame icon before score if momentum was burned)
  if (parsed.burn) {
    const burnEl = createSpan({ cls: "iv-inline-burn-icon" });
    setIcon(burnEl, "flame");
    container.appendChild(burnEl);
  }

  // Score - show effective score (after burn if applicable)
  container.appendChild(
    createSpan({ cls: "iv-inline-score", text: `${effectiveScore}` }),
  );

  // vs
  container.appendChild(createSpan({ text: " vs " }));

  // Challenge dice
  container.appendChild(
    createSpan({ cls: "iv-inline-challenge-die vs1", text: `${parsed.vs1}` }),
  );
  container.appendChild(createSpan({ text: "|" }));
  container.appendChild(
    createSpan({ cls: "iv-inline-challenge-die vs2", text: `${parsed.vs2}` }),
  );

  // Match text (after dice, if applicable)
  if (match) {
    container.appendChild(
      createSpan({ cls: "iv-inline-match", text: "match" }),
    );
  }

  // Build tooltip
  let tooltipText = outcomeText(outcome) + (match ? " (match)" : "");
  const addsDisplay = formatAddsForDisplay(parsed.addsDetail, parsed.adds);
  const hasAdds =
    parsed.adds > 0 || (parsed.addsDetail && parsed.addsDetail.length > 0);
  const rollBreakdown = hasAdds
    ? `${parsed.action} (roll) + ${parsed.statVal} (${parsed.stat}) + ${addsDisplay} = ${originalScore}`
    : `${parsed.action} (roll) + ${parsed.statVal} (${parsed.stat}) = ${originalScore}`;
  tooltipText += `\n${rollBreakdown}`;
  if (parsed.burn) {
    tooltipText += `\nBurned momentum (${parsed.burn.orig}→${parsed.burn.reset})`;
  }
  setTooltip(container, tooltipText);

  return container;
}

/**
 * Render an inline progress roll result.
 */
export function renderInlineProgress(
  parsed: ParsedInlineProgress,
  plugin: IronVaultPlugin,
): HTMLSpanElement {
  const { outcome, match } = determineOutcome(
    parsed.score,
    parsed.vs1,
    parsed.vs2,
  );

  const outcomeClass = match ? `${outcome} match` : outcome;
  const container = createContainer(outcomeClass);

  // Outcome icon (first for immediate visual feedback)
  container.appendChild(createSpan({ cls: "iv-inline-outcome-icon" }));

  // Move name (clickable if we have a moveId)
  container.appendChild(
    createMoveNameLink(parsed.moveName, parsed.moveId, plugin),
  );

  // Track name (clickable if we have a path)
  const trackEl = createSpan({
    cls: "iv-inline-progress-track",
    text: parsed.trackName,
  });
  if (parsed.trackPath) {
    trackEl.addClass("iv-inline-link");
    trackEl.setAttribute("data-track-path", parsed.trackPath);
    trackEl.addEventListener("click", (e) => {
      e.stopPropagation();
      e.preventDefault();
      plugin.app.workspace.openLinkText(parsed.trackPath!, "");
    });
  }
  container.appendChild(trackEl);

  // Separator
  container.appendChild(createSpan({ cls: "iv-inline-separator", text: "—" }));

  // Score
  container.appendChild(
    createSpan({ cls: "iv-inline-score", text: `${parsed.score}` }),
  );

  // vs
  container.appendChild(createSpan({ text: " vs " }));

  // Challenge dice
  container.appendChild(
    createSpan({ cls: "iv-inline-challenge-die vs1", text: `${parsed.vs1}` }),
  );
  container.appendChild(createSpan({ text: "|" }));
  container.appendChild(
    createSpan({ cls: "iv-inline-challenge-die vs2", text: `${parsed.vs2}` }),
  );

  // Match text (after dice, if applicable)
  if (match) {
    container.appendChild(
      createSpan({ cls: "iv-inline-match", text: "match" }),
    );
  }

  // Tooltip
  setTooltip(container, outcomeText(outcome) + (match ? " (match)" : ""));

  return container;
}

/**
 * Render an inline no-roll move.
 */
export function renderInlineNoRoll(
  parsed: ParsedInlineNoRoll,
  plugin: IronVaultPlugin,
): HTMLSpanElement {
  const container = createContainer("no-roll");

  // No-roll icon
  const iconEl = createSpan({ cls: "iv-inline-noroll-icon" });
  setIcon(iconEl, "file-pen-line");
  container.appendChild(iconEl);

  // Move name (clickable if we have a moveId)
  container.appendChild(createMoveNameLink(parsed.name, parsed.moveId, plugin));

  return container;
}
