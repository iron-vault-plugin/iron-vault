/**
 * Dice-related inline renderers.
 * Handles dice rolls, action rolls (without moves), and rerolls.
 */

import IronVaultPlugin from "index";
import { setIcon } from "obsidian";
import {
  ParsedInlineDiceRoll,
  ParsedInlineActionRoll,
  ParsedInlineReroll,
  determineOutcome,
  outcomeText,
  formatAddsForDisplay,
} from "../syntax";
import { createContainer, setTooltip } from "./shared";

/**
 * Render an inline dice roll result.
 */
export function renderInlineDiceRoll(
  parsed: ParsedInlineDiceRoll,
  _plugin: IronVaultPlugin,
): HTMLSpanElement {
  const container = createContainer("dice-roll");

  // Dice icon
  const iconEl = createSpan({ cls: "iv-inline-dice-icon" });
  setIcon(iconEl, "dice");
  container.appendChild(iconEl);

  // Expression
  container.appendChild(
    createSpan({ cls: "iv-inline-dice-expression", text: parsed.expression }),
  );

  // Arrow
  container.appendChild(
    createSpan({ cls: "iv-inline-dice-arrow", text: " → " }),
  );

  // Result
  container.appendChild(
    createSpan({ cls: "iv-inline-dice-result", text: `${parsed.result}` }),
  );

  setTooltip(container, `${parsed.expression} = ${parsed.result}`);

  return container;
}

/**
 * Render an inline action roll result (without a move).
 */
export function renderInlineActionRoll(
  parsed: ParsedInlineActionRoll,
  _plugin: IronVaultPlugin,
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

  // Stat (in parentheses) - no move name, just the stat
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
 * Render an inline reroll result.
 * Shows which die was rerolled (old to new), the new score, and challenge dice.
 */
export function renderInlineReroll(
  parsed: ParsedInlineReroll,
  _plugin: IronVaultPlugin,
): HTMLSpanElement {
  // Calculate the new action value (if action was rerolled, use newVal; otherwise use original)
  const effectiveAction =
    parsed.die === "action" ? parsed.newVal : parsed.action;

  // Calculate the new challenge dice values
  const effectiveVs1 = parsed.die === "vs1" ? parsed.newVal : parsed.vs1;
  const effectiveVs2 = parsed.die === "vs2" ? parsed.newVal : parsed.vs2;

  // Calculate the new score
  const newScore = Math.min(10, effectiveAction + parsed.statVal + parsed.adds);

  // Determine outcome based on new values
  const { outcome, match } = determineOutcome(
    newScore,
    effectiveVs1,
    effectiveVs2,
  );

  const outcomeClass = match ? `${outcome} match` : outcome;
  const container = createContainer(`reroll ${outcomeClass}`);

  // Reroll icon
  const rerollIconEl = createSpan({ cls: "iv-inline-reroll-icon" });
  setIcon(rerollIconEl, "refresh-cw");
  container.appendChild(rerollIconEl);

  // Outcome icon (strong hit/weak hit/miss indicator)
  container.appendChild(createSpan({ cls: "iv-inline-outcome-icon" }));

  // Die label with old to new value
  const dieLabel = parsed.die === "action" ? "act" : parsed.die;
  container.appendChild(
    createSpan({
      cls: "iv-inline-reroll-change",
      text: `(${dieLabel}: ${parsed.oldVal}→${parsed.newVal})`,
    }),
  );

  // Separator
  container.appendChild(createSpan({ cls: "iv-inline-separator", text: "=" }));

  // New score
  container.appendChild(
    createSpan({ cls: "iv-inline-score", text: `${newScore}` }),
  );

  // vs
  container.appendChild(createSpan({ text: " vs " }));

  // Challenge dice (highlight the one that was rerolled)
  container.appendChild(
    createSpan({
      cls: `iv-inline-challenge-die vs1${parsed.die === "vs1" ? " rerolled" : ""}`,
      text: `${effectiveVs1}`,
    }),
  );
  container.appendChild(createSpan({ text: "|" }));
  container.appendChild(
    createSpan({
      cls: `iv-inline-challenge-die vs2${parsed.die === "vs2" ? " rerolled" : ""}`,
      text: `${effectiveVs2}`,
    }),
  );

  // Match text (after dice, if applicable)
  if (match) {
    container.appendChild(
      createSpan({ cls: "iv-inline-match", text: "match" }),
    );
  }

  // Tooltip with details
  const dieFullLabel =
    parsed.die === "action"
      ? "Action die"
      : parsed.die === "vs1"
        ? "Challenge die 1"
        : "Challenge die 2";
  setTooltip(
    container,
    `${outcomeText(outcome)}${match ? " (match)" : ""}\nRerolled ${dieFullLabel}: ${parsed.oldVal} → ${parsed.newVal}`,
  );

  return container;
}
