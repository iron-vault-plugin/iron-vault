/**
 * Inline mechanics renderers.
 * Creates DOM elements for inline move, oracle, and progress results.
 */

import IronVaultPlugin from "index";
import { MoveModal } from "moves/move-modal";
import { setIcon } from "obsidian";
import { OracleModal } from "oracles/oracle-modal";
import { SidebarView } from "sidebar/sidebar-view";
import {
  ParsedInlineMove,
  ParsedInlineOracle,
  ParsedInlineProgress,
  ParsedInlineNoRoll,
  ParsedInlineTrackAdvance,
  ParsedInlineTrackCreate,
  ParsedInlineTrackComplete,
  ParsedInlineTrackReopen,
  ParsedInlineClockCreate,
  ParsedInlineClockAdvance,
  ParsedInlineClockResolve,
  ParsedInlineMeter,
  ParsedInlineBurn,
  ParsedInlineInitiative,
  ParsedInlineEntityCreate,
  ParsedInlineDiceRoll,
  ParsedInlineActionRoll,
  ParsedInlineReroll,
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
  const iconEl = createSpan({ cls: "iv-inline-outcome-icon" });
  container.appendChild(iconEl);

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

  // Separator
  container.appendChild(createSpan({ cls: "iv-inline-separator", text: "—" }));

  // Burn indicator (flame icon before score if momentum was burned)
  if (parsed.burn) {
    const burnEl = createSpan({ cls: "iv-inline-burn-icon" });
    setIcon(burnEl, "flame");
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
  const hasAdds =
    parsed.adds > 0 || (parsed.addsDetail && parsed.addsDetail.length > 0);
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

  // Oracle icon
  const iconEl = createSpan({ cls: "iv-inline-oracle-icon" });
  setIcon(iconEl, "sparkles");
  container.appendChild(iconEl);

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
  plugin: IronVaultPlugin,
): HTMLSpanElement {
  const { outcome, match } = determineOutcome(
    parsed.score,
    parsed.vs1,
    parsed.vs2,
  );

  const outcomeClass = match ? `${outcome} match` : outcome;
  const container = createContainer(outcomeClass);

  // Outcome icon (first for immediate visual feedback, like action moves)
  const iconEl = createSpan({ cls: "iv-inline-outcome-icon" });
  container.appendChild(iconEl);

  // Move name (clickable if we have a moveId)
  const moveNameEl = createSpan({
    cls: "iv-inline-move-name",
    text: parsed.moveName,
  });
  if (parsed.moveId) {
    moveNameEl.addClass("iv-inline-link");
    moveNameEl.setAttribute("data-move-id", parsed.moveId);
    moveNameEl.addEventListener("click", (e) => {
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
  container.appendChild(moveNameEl);

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

  // No-roll icon
  const iconEl = createSpan({ cls: "iv-inline-noroll-icon" });
  setIcon(iconEl, "file-pen-line");
  container.appendChild(iconEl);

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

// ============================================================================
// Track Renderers
// ============================================================================

/**
 * Create a clickable link to a track file.
 */
function createTrackLink(
  name: string,
  path: string,
  plugin: IronVaultPlugin,
): HTMLSpanElement {
  const linkEl = createSpan({
    cls: "iv-inline-track-name iv-inline-link",
    text: name,
  });
  linkEl.setAttribute("data-track-path", path);
  linkEl.addEventListener("click", (e) => {
    e.stopPropagation();
    e.preventDefault();
    plugin.app.workspace.openLinkText(path, "");
  });
  return linkEl;
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
  // Ticks are stored as raw values, divide by 4 to get filled boxes
  const filledBoxes = Math.floor(parsed.to / 4);
  const progressEl = createSpan({
    cls: "iv-inline-track-progress",
    text: ` +${parsed.steps} (${filledBoxes}/10)`,
  });
  container.appendChild(progressEl);

  // Tooltip with details
  const fromBoxes = Math.floor(parsed.from / 4);
  const tooltip = `Progress: ${fromBoxes} → ${filledBoxes} boxes\nRank: ${parsed.rank}\nSteps: ${parsed.steps}`;
  container.setAttribute("aria-label", tooltip);
  container.setAttribute("data-tooltip-position", "top");

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

  // Tooltip
  container.setAttribute("aria-label", "Track created");
  container.setAttribute("data-tooltip-position", "top");

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

  // Tooltip
  container.setAttribute("aria-label", "Track completed");
  container.setAttribute("data-tooltip-position", "top");

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

  // Tooltip
  container.setAttribute("aria-label", "Track reopened");
  container.setAttribute("data-tooltip-position", "top");

  return container;
}

// ============================================================================
// Clock Renderers
// ============================================================================

/**
 * Create a clickable link to a clock file.
 */
function createClockLink(
  name: string,
  path: string,
  plugin: IronVaultPlugin,
): HTMLSpanElement {
  const linkEl = createSpan({
    cls: "iv-inline-clock-name iv-inline-link",
    text: name,
  });
  linkEl.setAttribute("data-clock-path", path);
  linkEl.addEventListener("click", (e) => {
    e.stopPropagation();
    e.preventDefault();
    plugin.app.workspace.openLinkText(path, "");
  });
  return linkEl;
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

  // Tooltip
  container.setAttribute("aria-label", "Clock created");
  container.setAttribute("data-tooltip-position", "top");

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
    const progressEl = createSpan({
      cls: "iv-inline-clock-progress",
      text: ` (${parsed.from}/${parsed.total})`,
    });
    container.appendChild(progressEl);

    // Show the failed odds roll with shortened format
    const oddsEl = createSpan({
      cls: "iv-inline-clock-odds-failed",
      text: ` ✗${parsed.oddsRoll.odds}`,
    });
    container.appendChild(oddsEl);

    // Tooltip with full details
    const tooltip = `Odds roll failed\n${parsed.oddsRoll.odds}: rolled ${parsed.oddsRoll.roll}`;
    container.setAttribute("aria-label", tooltip);
    container.setAttribute("data-tooltip-position", "top");

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
  const progressEl = createSpan({
    cls: "iv-inline-clock-progress",
    text: ` +${parsed.segments} (${parsed.to}/${parsed.total})`,
  });
  container.appendChild(progressEl);

  // If there's an odds roll that succeeded, show shortened format
  if (parsed.oddsRoll) {
    const oddsEl = createSpan({
      cls: "iv-inline-clock-odds-success",
      text: ` ✓${parsed.oddsRoll.odds}`,
    });
    container.appendChild(oddsEl);
  }

  // Tooltip with details
  let tooltip = `Segments: ${parsed.from} → ${parsed.to} (+${parsed.segments})`;
  if (parsed.oddsRoll) {
    tooltip += `\n${parsed.oddsRoll.odds}: rolled ${parsed.oddsRoll.roll}`;
  }
  container.setAttribute("aria-label", tooltip);
  container.setAttribute("data-tooltip-position", "top");

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

  // Tooltip
  container.setAttribute("aria-label", "Clock resolved");
  container.setAttribute("data-tooltip-position", "top");

  return container;
}

// ============================================================================
// Meter Renderers
// ============================================================================

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
  const nameEl = createSpan({
    cls: "iv-inline-meter-name",
    text: parsed.name,
  });
  container.appendChild(nameEl);

  // Change indicator
  const changeEl = createSpan({
    cls: "iv-inline-meter-change",
    text: ` ${parsed.from}→${parsed.to}`,
  });
  container.appendChild(changeEl);

  // Tooltip
  const deltaStr = isIncrease ? `+${delta}` : `${delta}`;
  container.setAttribute("aria-label", `${parsed.name}: ${deltaStr}`);
  container.setAttribute("data-tooltip-position", "top");

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
  const labelEl = createSpan({
    cls: "iv-inline-burn-label",
    text: "Burn",
  });
  container.appendChild(labelEl);

  // Change indicator
  const changeEl = createSpan({
    cls: "iv-inline-burn-change",
    text: ` ${parsed.from}→${parsed.to}`,
  });
  container.appendChild(changeEl);

  // Tooltip
  container.setAttribute(
    "aria-label",
    `Burned momentum: ${parsed.from} → ${parsed.to}`,
  );
  container.setAttribute("data-tooltip-position", "top");

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
  } else if (toValue === "bad spot") {
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

  // Label with colon (Initiative: or Position:)
  const labelEl = createSpan({
    cls: "iv-inline-initiative-label",
    text: `${parsed.label}:`,
  });
  container.appendChild(labelEl);

  // Show current state (just the "to" value)
  if (capitalizedTo) {
    const changeEl = createSpan({
      cls: "iv-inline-initiative-change",
      text: capitalizedTo,
    });
    container.appendChild(changeEl);
  }

  // Tooltip shows the transition if we have both values
  let tooltip = parsed.label;
  if (parsed.from && parsed.to) {
    tooltip += `: ${parsed.from} → ${parsed.to}`;
  } else if (parsed.to) {
    tooltip += `: ${parsed.to}`;
  }
  container.setAttribute("aria-label", tooltip);
  container.setAttribute("data-tooltip-position", "top");

  return container;
}

// ============================================================================
// Entity Renderers
// ============================================================================

/**
 * Create a clickable link to an entity file.
 */
function createEntityLink(
  name: string,
  path: string,
  plugin: IronVaultPlugin,
): HTMLSpanElement {
  const linkEl = createSpan({
    cls: "iv-inline-entity-name iv-inline-link",
    text: name,
  });
  linkEl.setAttribute("data-entity-path", path);
  linkEl.addEventListener("click", (e) => {
    e.stopPropagation();
    e.preventDefault();
    plugin.app.workspace.openLinkText(path, "");
  });
  return linkEl;
}

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
  const typeEl = createSpan({
    cls: "iv-inline-entity-type",
    text: `${parsed.entityType}:`,
  });
  container.appendChild(typeEl);

  // Entity name (clickable)
  container.appendChild(createEntityLink(parsed.name, parsed.path, plugin));

  // Tooltip
  container.setAttribute("aria-label", `${parsed.entityType} created`);
  container.setAttribute("data-tooltip-position", "top");

  return container;
}

// ============================================================================
// Dice Roll Renderers
// ============================================================================

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
  const exprEl = createSpan({
    cls: "iv-inline-dice-expression",
    text: parsed.expression,
  });
  container.appendChild(exprEl);

  // Arrow
  container.appendChild(
    createSpan({ cls: "iv-inline-dice-arrow", text: " → " }),
  );

  // Result
  const resultEl = createSpan({
    cls: "iv-inline-dice-result",
    text: `${parsed.result}`,
  });
  container.appendChild(resultEl);

  // Tooltip
  container.setAttribute(
    "aria-label",
    `${parsed.expression} = ${parsed.result}`,
  );
  container.setAttribute("data-tooltip-position", "top");

  return container;
}

// ============================================================================
// Action Roll Renderers
// ============================================================================

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
  const iconEl = createSpan({ cls: "iv-inline-outcome-icon" });
  container.appendChild(iconEl);

  // Stat (in parentheses) - no move name, just the stat
  const statEl = createSpan({
    cls: "iv-inline-stat",
    text: `(${parsed.stat})`,
  });
  container.appendChild(statEl);

  // Separator
  container.appendChild(createSpan({ cls: "iv-inline-separator", text: "—" }));

  // Burn indicator (flame icon before score if momentum was burned)
  if (parsed.burn) {
    const burnEl = createSpan({ cls: "iv-inline-burn-icon" });
    setIcon(burnEl, "flame");
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
  const hasAdds =
    parsed.adds > 0 || (parsed.addsDetail && parsed.addsDetail.length > 0);
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

// ============================================================================
// Reroll Renderers
// ============================================================================

/**
 * Render an inline reroll result.
 * Shows which die was rerolled (old→new), the new score, and challenge dice.
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
  const outcomeIconEl = createSpan({ cls: "iv-inline-outcome-icon" });
  container.appendChild(outcomeIconEl);

  // Die label with old→new value
  const dieLabel = parsed.die === "action" ? "act" : parsed.die;
  const dieChangeEl = createSpan({
    cls: "iv-inline-reroll-change",
    text: `(${dieLabel}: ${parsed.oldVal}→${parsed.newVal})`,
  });
  container.appendChild(dieChangeEl);

  // Separator
  container.appendChild(createSpan({ cls: "iv-inline-separator", text: "=" }));

  // New score
  const scoreEl = createSpan({
    cls: "iv-inline-score",
    text: `${newScore}`,
  });
  container.appendChild(scoreEl);

  // vs
  container.appendChild(createSpan({ text: " vs " }));

  // Challenge dice (highlight the one that was rerolled)
  const vs1El = createSpan({
    cls: `iv-inline-challenge-die vs1${parsed.die === "vs1" ? " rerolled" : ""}`,
    text: `${effectiveVs1}`,
  });
  container.appendChild(vs1El);

  container.appendChild(createSpan({ text: "|" }));

  const vs2El = createSpan({
    cls: `iv-inline-challenge-die vs2${parsed.die === "vs2" ? " rerolled" : ""}`,
    text: `${effectiveVs2}`,
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

  // Tooltip with details
  const dieFullLabel =
    parsed.die === "action"
      ? "Action die"
      : parsed.die === "vs1"
        ? "Challenge die 1"
        : "Challenge die 2";
  const tooltipText = `${outcomeText(outcome)}${match ? " (match)" : ""}\nRerolled ${dieFullLabel}: ${parsed.oldVal} → ${parsed.newVal}`;
  container.setAttribute("aria-label", tooltipText);
  container.setAttribute("data-tooltip-position", "top");

  return container;
}
