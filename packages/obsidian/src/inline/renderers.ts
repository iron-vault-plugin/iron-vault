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
  plugin: IronVaultPlugin,
): HTMLSpanElement {
  const { outcome, match } = determineOutcome(
    parsed.score,
    parsed.vs1,
    parsed.vs2,
  );

  const outcomeClass = match ? `${outcome} match` : outcome;
  const container = createContainer(outcomeClass);

  // Track name (clickable if we have a path)
  const nameEl = createSpan({
    cls: "iv-inline-progress-name",
    text: parsed.trackName,
  });
  if (parsed.trackPath) {
    nameEl.addClass("iv-inline-link");
    nameEl.setAttribute("data-track-path", parsed.trackPath);
    nameEl.addEventListener("click", (e) => {
      e.stopPropagation();
      e.preventDefault();
      plugin.app.workspace.openLinkText(parsed.trackPath!, "");
    });
  }
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
  setIcon(iconEl, "circle-check-big");
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
  setIcon(iconEl, "clock-check");
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

  // Burn icon
  const iconEl = createSpan({
    cls: "iv-inline-burn-icon",
    text: "🔥 ",
  });
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
  container.setAttribute("aria-label", `Burned momentum: ${parsed.from} → ${parsed.to}`);
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
  const container = createContainer("initiative");

  // Label (Initiative or Position)
  const labelEl = createSpan({
    cls: "iv-inline-initiative-label",
    text: parsed.label,
  });
  container.appendChild(labelEl);

  // Show current state (just the "to" value)
  if (parsed.to) {
    const changeEl = createSpan({
      cls: "iv-inline-initiative-change",
      text: `: ${parsed.to}`,
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
