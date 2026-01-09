/**
 * Inline mechanics post-processor for Reading View.
 * Finds inline code elements with iv-move:, iv-oracle:, or iv-progress: prefixes
 * and replaces them with rendered results.
 */

import { MarkdownPostProcessorContext } from "obsidian";
import IronVaultPlugin from "index";
import {
  isInlineMechanics,
  parseMoveInline,
  parseOracleInline,
  parseProgressInline,
  parseNoRollInline,
  parseTrackAdvanceInline,
  parseTrackCreateInline,
  parseTrackCompleteInline,
  parseTrackReopenInline,
  parseClockCreateInline,
  parseClockAdvanceInline,
  parseClockResolveInline,
  parseMeterInline,
  parseBurnInline,
  parseInitiativeInline,
  parseEntityCreateInline,
  parseDiceRollInline,
  parseActionRollInline,
  parseRerollInline,
} from "./syntax";
import {
  renderInlineMove,
  renderInlineOracle,
  renderInlineProgress,
  renderInlineNoRoll,
  renderInlineTrackAdvance,
  renderInlineTrackCreate,
  renderInlineTrackComplete,
  renderInlineTrackReopen,
  renderInlineClockCreate,
  renderInlineClockAdvance,
  renderInlineClockResolve,
  renderInlineMeter,
  renderInlineBurn,
  renderInlineInitiative,
  renderInlineEntityCreate,
  renderInlineDiceRoll,
  renderInlineActionRoll,
  renderInlineReroll,
} from "./renderers";

/**
 * Register the inline mechanics post-processor.
 */
export function registerInlineProcessor(plugin: IronVaultPlugin): void {
  plugin.registerMarkdownPostProcessor(
    (el: HTMLElement, ctx: MarkdownPostProcessorContext) => {
      processInlineMechanics(el, plugin, ctx);
    },
  );
}

/**
 * Process inline mechanics in an element.
 */
function processInlineMechanics(
  el: HTMLElement,
  plugin: IronVaultPlugin,
  _ctx: MarkdownPostProcessorContext,
): void {
  // Find all code elements
  const codeElements = el.querySelectorAll("code");

  for (const code of Array.from(codeElements)) {
    const text = code.innerText.trim();

    // Skip if not inline mechanics
    if (!isInlineMechanics(text)) continue;

    // Try to parse and render move
    const moveData = parseMoveInline(text);
    if (moveData) {
      const rendered = renderInlineMove(moveData, plugin);
      code.replaceWith(rendered);
      continue;
    }

    // Try to parse and render oracle
    const oracleData = parseOracleInline(text);
    if (oracleData) {
      const rendered = renderInlineOracle(oracleData, plugin);
      code.replaceWith(rendered);
      continue;
    }

    // Try to parse and render progress
    const progressData = parseProgressInline(text);
    if (progressData) {
      const rendered = renderInlineProgress(progressData, plugin);
      code.replaceWith(rendered);
      continue;
    }

    // Try to parse and render no-roll move
    const noRollData = parseNoRollInline(text);
    if (noRollData) {
      const rendered = renderInlineNoRoll(noRollData, plugin);
      code.replaceWith(rendered);
      continue;
    }

    // Try to parse and render track advance
    const trackAdvanceData = parseTrackAdvanceInline(text);
    if (trackAdvanceData) {
      const rendered = renderInlineTrackAdvance(trackAdvanceData, plugin);
      code.replaceWith(rendered);
      continue;
    }

    // Try to parse and render track create
    const trackCreateData = parseTrackCreateInline(text);
    if (trackCreateData) {
      const rendered = renderInlineTrackCreate(trackCreateData, plugin);
      code.replaceWith(rendered);
      continue;
    }

    // Try to parse and render track complete
    const trackCompleteData = parseTrackCompleteInline(text);
    if (trackCompleteData) {
      const rendered = renderInlineTrackComplete(trackCompleteData, plugin);
      code.replaceWith(rendered);
      continue;
    }

    // Try to parse and render track reopen
    const trackReopenData = parseTrackReopenInline(text);
    if (trackReopenData) {
      const rendered = renderInlineTrackReopen(trackReopenData, plugin);
      code.replaceWith(rendered);
      continue;
    }

    // Try to parse and render clock create
    const clockCreateData = parseClockCreateInline(text);
    if (clockCreateData) {
      const rendered = renderInlineClockCreate(clockCreateData, plugin);
      code.replaceWith(rendered);
      continue;
    }

    // Try to parse and render clock advance
    const clockAdvanceData = parseClockAdvanceInline(text);
    if (clockAdvanceData) {
      const rendered = renderInlineClockAdvance(clockAdvanceData, plugin);
      code.replaceWith(rendered);
      continue;
    }

    // Try to parse and render clock resolve
    const clockResolveData = parseClockResolveInline(text);
    if (clockResolveData) {
      const rendered = renderInlineClockResolve(clockResolveData, plugin);
      code.replaceWith(rendered);
      continue;
    }

    // Try to parse and render meter
    const meterData = parseMeterInline(text);
    if (meterData) {
      const rendered = renderInlineMeter(meterData, plugin);
      code.replaceWith(rendered);
      continue;
    }

    // Try to parse and render burn
    const burnData = parseBurnInline(text);
    if (burnData) {
      const rendered = renderInlineBurn(burnData, plugin);
      code.replaceWith(rendered);
      continue;
    }

    // Try to parse and render initiative
    const initiativeData = parseInitiativeInline(text);
    if (initiativeData) {
      const rendered = renderInlineInitiative(initiativeData, plugin);
      code.replaceWith(rendered);
      continue;
    }

    // Try to parse and render entity create
    const entityCreateData = parseEntityCreateInline(text);
    if (entityCreateData) {
      const rendered = renderInlineEntityCreate(entityCreateData, plugin);
      code.replaceWith(rendered);
      continue;
    }

    // Try to parse and render dice roll
    const diceRollData = parseDiceRollInline(text);
    if (diceRollData) {
      const rendered = renderInlineDiceRoll(diceRollData, plugin);
      code.replaceWith(rendered);
      continue;
    }

    // Try to parse and render action roll
    const actionRollData = parseActionRollInline(text);
    if (actionRollData) {
      const rendered = renderInlineActionRoll(actionRollData, plugin);
      code.replaceWith(rendered);
      continue;
    }

    // Try to parse and render reroll
    const rerollData = parseRerollInline(text);
    if (rerollData) {
      const rendered = renderInlineReroll(rerollData, plugin);
      code.replaceWith(rendered);
      continue;
    }
  }
}
