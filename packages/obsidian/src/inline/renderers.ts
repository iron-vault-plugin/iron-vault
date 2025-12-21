/**
 * Inline mechanics renderers.
 * Creates DOM elements for inline move, oracle, and progress results.
 */

import IronVaultPlugin from "index";
import { MoveModal } from "moves/move-modal";
import { OracleModal } from "oracles/oracle-modal";
import { SidebarView } from "sidebar/sidebar-view";
import {
  ParsedInlineMove,
  ParsedInlineOracle,
  ParsedInlineProgress,
  ParsedInlineNoRoll,
  determineOutcome,
  outcomeText,
  formatAddsForDisplay,
} from "./syntax";

/**
 * Create the container element for inline mechanics.
 */
function createContainer(outcomeClass: string): HTMLSpanElement {
  return createSpan({
    cls: `iv-inline-mechanics ${outcomeClass}`,
  });
}

/**
 * Render an inline move result.
 */
export function renderInlineMove(
  parsed: ParsedInlineMove,
  plugin: IronVaultPlugin,
): HTMLSpanElement {
  // Calculate the original score (before burn)
  const originalScore = Math.min(10, parsed.action + parsed.statVal + parsed.adds);
  
  // If burn was used, the effective score is the burn.orig (momentum value)
  const effectiveScore = parsed.burn ? parsed.burn.orig : originalScore;
  
  // Determine outcome based on effective score
  const { outcome, match } = determineOutcome(effectiveScore, parsed.vs1, parsed.vs2);

  const outcomeClass = match ? `${outcome} match` : outcome;
  const container = createContainer(outcomeClass);

  // Move name (clickable if we have a moveId)
  const nameEl = createSpan({ cls: "iv-inline-move-name", text: parsed.name });
  if (parsed.moveId) {
    nameEl.addClass("iv-inline-link");
    nameEl.setAttribute("data-move-id", parsed.moveId);
    nameEl.addEventListener("click", (e) => {
      e.stopPropagation();
      e.preventDefault();

      // Match the behavior of mechanics blocks:
      // - If useLegacyMoveModal is enabled, open the modal
      // - Otherwise, open in sidebar
      if (plugin.settings.useLegacyMoveModal) {
        // Find the move in the datastore and open modal
        const move = plugin.datastore.dataContext.moves.get(parsed.moveId!);
        if (move) {
          new MoveModal(
            plugin.app,
            plugin,
            plugin.datastore.dataContext,
            move,
          ).open();
        }
      } else {
        SidebarView.activate(plugin.app, parsed.moveId!);
      }
    });
  }
  container.appendChild(nameEl);

  // Stat (in parentheses) - no leading space, gap handles it
  const statEl = createSpan({
    cls: "iv-inline-stat",
    text: `(${parsed.stat})`,
  });
  container.appendChild(statEl);

  // Outcome icon (after stat, before semicolon)
  const iconEl = createSpan({ cls: "iv-inline-outcome-icon" });
  container.appendChild(iconEl);

  // Separator
  container.appendChild(createSpan({ text: "; " }));

  // Burn indicator (flame icon before score if momentum was burned)
  if (parsed.burn) {
    const burnEl = createSpan({
      cls: "iv-inline-burn-icon",
      text: "🔥",
    });
    container.appendChild(burnEl);
  }

  // Score - show effective score (after burn if applicable)
  const scoreEl = createSpan({
    cls: "iv-inline-score",
    text: `${effectiveScore}`,
  });
  container.appendChild(scoreEl);

  // vs
  container.appendChild(createSpan({ text: " vs " }));

  // Challenge dice
  const vs1El = createSpan({
    cls: "iv-inline-challenge-die vs1",
    text: `${parsed.vs1}`,
  });
  container.appendChild(vs1El);

  container.appendChild(createSpan({ text: "|" }));

  const vs2El = createSpan({
    cls: "iv-inline-challenge-die vs2",
    text: `${parsed.vs2}`,
  });
  container.appendChild(vs2El);

  // Match text (after dice, if applicable)
  if (match) {
    const matchEl = createSpan({
      cls: "iv-inline-match",
      text: "match",
    });
    container.appendChild(matchEl);
  }

  // Outcome text (in tooltip) - include adds breakdown if available
  let outcomeLabel = outcomeText(outcome) + (match ? " (match)" : "");
  
  // Add roll breakdown to tooltip with minimal labels
  const addsDisplay = formatAddsForDisplay(parsed.addsDetail, parsed.adds);
  const hasAdds = parsed.adds > 0 || (parsed.addsDetail && parsed.addsDetail.length > 0);
  const rollBreakdown = hasAdds
    ? `${parsed.action} (roll) + ${parsed.statVal} (${parsed.stat}) + ${addsDisplay} = ${originalScore}`
    : `${parsed.action} (roll) + ${parsed.statVal} (${parsed.stat}) = ${originalScore}`;
  outcomeLabel += `\n${rollBreakdown}`;
  
  if (parsed.burn) {
    outcomeLabel += `\nBurned momentum (${parsed.burn.orig}→${parsed.burn.reset})`;
  }
  container.setAttribute("aria-label", outcomeLabel);
  container.setAttribute("data-tooltip-position", "top");

  return container;
}

/**
 * Render an inline oracle result.
 */
export function renderInlineOracle(
  parsed: ParsedInlineOracle,
  plugin: IronVaultPlugin,
): HTMLSpanElement {
  const container = createContainer("oracle");

  // Oracle name (clickable if we have an oracleId - always opens modal like mechanics blocks)
  const nameEl = createSpan({
    cls: "iv-inline-oracle-name",
    text: parsed.name + ":",
  });
  if (parsed.oracleId) {
    nameEl.addClass("iv-inline-link");
    nameEl.setAttribute("data-oracle-id", parsed.oracleId);
    nameEl.addEventListener("click", (e) => {
      e.stopPropagation();
      e.preventDefault();

      // Oracles always open in a modal (matching mechanics block behavior)
      const oracle = plugin.datastore.dataContext.oracles.get(parsed.oracleId!);
      if (oracle) {
        new OracleModal(plugin.app, plugin, oracle).open();
      }
    });
  }
  container.appendChild(nameEl);

  // Result
  const resultEl = createSpan({
    cls: "iv-inline-oracle-result",
    text: parsed.result,
  });
  container.appendChild(resultEl);

  // Cursed die if present (keep visible since it's thematically important)
  if (parsed.cursedRoll != null) {
    const cursedEl = createSpan({
      cls: "iv-inline-cursed",
      text: ` 💀${parsed.cursedRoll}`,
    });
    container.appendChild(cursedEl);
  }

  // Tooltip with roll details
  let tooltipText = `Roll: ${parsed.roll}`;
  if (parsed.cursedRoll != null) {
    tooltipText += ` | Cursed: ${parsed.cursedRoll}`;
  }
  container.setAttribute("aria-label", tooltipText);
  container.setAttribute("data-tooltip-position", "top");

  return container;
}

/**
 * Render an inline progress roll result.
 */
export function renderInlineProgress(
  parsed: ParsedInlineProgress,
  _plugin: IronVaultPlugin,
): HTMLSpanElement {
  const { outcome, match } = determineOutcome(
    parsed.score,
    parsed.vs1,
    parsed.vs2,
  );

  const outcomeClass = match ? `${outcome} match` : outcome;
  const container = createContainer(outcomeClass);

  // Track name
  const nameEl = createSpan({
    cls: "iv-inline-progress-name",
    text: parsed.trackName,
  });
  container.appendChild(nameEl);

  // Outcome icon (after track name, like action moves)
  const iconEl = createSpan({ cls: "iv-inline-outcome-icon" });
  container.appendChild(iconEl);

  // Separator
  container.appendChild(createSpan({ text: "; " }));

  // Score
  const scoreEl = createSpan({
    cls: "iv-inline-score",
    text: `${parsed.score}`,
  });
  container.appendChild(scoreEl);

  // vs
  container.appendChild(createSpan({ text: " vs " }));

  // Challenge dice
  const vs1El = createSpan({
    cls: "iv-inline-challenge-die vs1",
    text: `${parsed.vs1}`,
  });
  container.appendChild(vs1El);

  container.appendChild(createSpan({ text: "|" }));

  const vs2El = createSpan({
    cls: "iv-inline-challenge-die vs2",
    text: `${parsed.vs2}`,
  });
  container.appendChild(vs2El);

  // Match text (after dice, if applicable)
  if (match) {
    const matchEl = createSpan({
      cls: "iv-inline-match",
      text: "match",
    });
    container.appendChild(matchEl);
  }

  // Outcome text (in tooltip)
  const outcomeLabel = outcomeText(outcome) + (match ? " (match)" : "");
  container.setAttribute("aria-label", outcomeLabel);
  container.setAttribute("data-tooltip-position", "top");

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

  // Move name (clickable if we have a moveId)
  const nameEl = createSpan({ cls: "iv-inline-move-name", text: parsed.name });
  if (parsed.moveId) {
    nameEl.addClass("iv-inline-link");
    nameEl.setAttribute("data-move-id", parsed.moveId);
    nameEl.addEventListener("click", (e) => {
      e.stopPropagation();
      e.preventDefault();

      // Match the behavior of mechanics blocks:
      // - If useLegacyMoveModal is enabled, open the modal
      // - Otherwise, open in sidebar
      if (plugin.settings.useLegacyMoveModal) {
        const move = plugin.datastore.dataContext.moves.get(parsed.moveId!);
        if (move) {
          new MoveModal(
            plugin.app,
            plugin,
            plugin.datastore.dataContext,
            move,
          ).open();
        }
      } else {
        SidebarView.activate(plugin.app, parsed.moveId!);
      }
    });
  }
  container.appendChild(nameEl);

  return container;
}
