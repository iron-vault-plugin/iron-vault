/**
 * Inline mechanics renderers.
 * Re-exports all renderer functions from their respective modules.
 */

import IronVaultPlugin from "index";
import { ParsedInlineMechanics } from "../syntax";
import {
  renderInlineMove,
  renderInlineProgress,
  renderInlineNoRoll,
} from "./moves";
import { renderInlineOracle } from "./oracles";
import {
  renderInlineTrackAdvance,
  renderInlineTrackCreate,
  renderInlineTrackComplete,
  renderInlineTrackReopen,
} from "./tracks";
import {
  renderInlineClockCreate,
  renderInlineClockAdvance,
  renderInlineClockResolve,
} from "./clocks";
import {
  renderInlineMeter,
  renderInlineBurn,
  renderInlineInitiative,
} from "./meters";
import { renderInlineEntityCreate } from "./entities";
import {
  renderInlineDiceRoll,
  renderInlineActionRoll,
  renderInlineReroll,
} from "./dice";
import { renderInlineOOC } from "./ooc";

// Re-export individual renderers
export {
  renderInlineMove,
  renderInlineProgress,
  renderInlineNoRoll,
} from "./moves";
export { renderInlineOracle } from "./oracles";
export {
  renderInlineTrackAdvance,
  renderInlineTrackCreate,
  renderInlineTrackComplete,
  renderInlineTrackReopen,
} from "./tracks";
export {
  renderInlineClockCreate,
  renderInlineClockAdvance,
  renderInlineClockResolve,
} from "./clocks";
export {
  renderInlineMeter,
  renderInlineBurn,
  renderInlineInitiative,
} from "./meters";
export { renderInlineEntityCreate } from "./entities";
export {
  renderInlineDiceRoll,
  renderInlineActionRoll,
  renderInlineReroll,
} from "./dice";
export { renderInlineOOC } from "./ooc";

/**
 * Render any parsed inline mechanics to an HTML element.
 * Central dispatch function used by both Reading View and Live Preview.
 */
export function renderParsedInline(
  parsed: ParsedInlineMechanics,
  plugin: IronVaultPlugin,
): HTMLSpanElement {
  switch (parsed.type) {
    case "move":
      return renderInlineMove(parsed, plugin);
    case "oracle":
      return renderInlineOracle(parsed, plugin);
    case "progress":
      return renderInlineProgress(parsed, plugin);
    case "no-roll":
      return renderInlineNoRoll(parsed, plugin);
    case "track-advance":
      return renderInlineTrackAdvance(parsed, plugin);
    case "track-create":
      return renderInlineTrackCreate(parsed, plugin);
    case "track-complete":
      return renderInlineTrackComplete(parsed, plugin);
    case "track-reopen":
      return renderInlineTrackReopen(parsed, plugin);
    case "clock-create":
      return renderInlineClockCreate(parsed, plugin);
    case "clock-advance":
      return renderInlineClockAdvance(parsed, plugin);
    case "clock-resolve":
      return renderInlineClockResolve(parsed, plugin);
    case "meter":
      return renderInlineMeter(parsed, plugin);
    case "burn":
      return renderInlineBurn(parsed, plugin);
    case "initiative":
      return renderInlineInitiative(parsed, plugin);
    case "entity-create":
      return renderInlineEntityCreate(parsed, plugin);
    case "dice-roll":
      return renderInlineDiceRoll(parsed, plugin);
    case "action-roll":
      return renderInlineActionRoll(parsed, plugin);
    case "reroll":
      return renderInlineReroll(parsed, plugin);
    case "ooc":
      return renderInlineOOC(parsed, plugin);
  }
}
