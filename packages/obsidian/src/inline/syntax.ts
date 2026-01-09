/**
 * Inline mechanics syntax parsing and generation utilities.
 *
 * Syntax formats:
 * - Moves: `iv-move:<name>|<stat>|<action>|<statVal>|<adds>|<vs1>|<vs2>[|<moveId>][|burn=<orig>:<reset>][|adds=<amount>(<desc>),...]`
 * - Oracles: `iv-oracle:<name>|<roll>|<result>[|<oracleId>][|cursed=<value>]`
 * - Progress: `iv-progress:<trackName>|<score>|<vs1>|<vs2>`
 */

import { ActionMoveDescription, ActionMoveAdd, ProgressMoveDescription, NoRollMoveDescription } from "moves/desc";
import { RollWrapper } from "model/rolls";
import { parseDataswornLinks } from "datastore/parsers/datasworn/id";

/**
 * Strip datasworn markdown links from text, keeping only the label.
 * e.g., "[Action](datasworn:oracle_rollable:starforged/core/action)" -> "Action"
 */
function stripDataswornLinks(text: string): string {
  return parseDataswornLinks(text)
    .map((segment) => (typeof segment === "string" ? segment : segment.label))
    .join("");
}

export interface ParsedInlineMove {
  type: "move";
  name: string;
  stat: string;
  action: number;
  statVal: number;
  /** Total adds (for backward compatibility) */
  adds: number;
  /** Individual adds with descriptions */
  addsDetail?: ActionMoveAdd[];
  vs1: number;
  vs2: number;
  moveId?: string;
  burn?: {
    orig: number;
    reset: number;
  };
}

export interface ParsedInlineOracle {
  type: "oracle";
  name: string;
  roll: number;
  result: string;
  oracleId?: string;
  cursedRoll?: number;
}

export interface ParsedInlineProgress {
  type: "progress";
  trackName: string;
  trackPath?: string;
  score: number;
  vs1: number;
  vs2: number;
}

export interface ParsedInlineNoRoll {
  type: "no-roll";
  name: string;
  moveId?: string;
}

// New types for tracks, clocks, and meters
export interface ParsedInlineTrackAdvance {
  type: "track-advance";
  name: string;
  path: string;
  from: number;
  to: number;
  rank: string;
  steps: number;
}

export interface ParsedInlineTrackCreate {
  type: "track-create";
  name: string;
  path: string;
}

export interface ParsedInlineTrackComplete {
  type: "track-complete";
  name: string;
  path: string;
}

export interface ParsedInlineTrackReopen {
  type: "track-reopen";
  name: string;
  path: string;
}

export interface ParsedInlineClockCreate {
  type: "clock-create";
  name: string;
  path: string;
}

export interface ParsedInlineClockAdvance {
  type: "clock-advance";
  name: string;
  path: string;
  from: number;
  to: number;
  /** Number of segments added */
  segments: number;
  /** Total clock size */
  total: number;
  /** Optional oracle roll for odds-based advancement */
  oddsRoll?: {
    odds: string;
    roll: number;
    result: "Yes" | "No";
  };
}

export interface ParsedInlineClockResolve {
  type: "clock-resolve";
  name: string;
  path: string;
}

export interface ParsedInlineMeter {
  type: "meter";
  name: string;
  from: number;
  to: number;
}

export interface ParsedInlineBurn {
  type: "burn";
  from: number;
  to: number;
}

export interface ParsedInlineInitiative {
  type: "initiative";
  label: string;
  from?: string;
  to?: string;
}

export interface ParsedInlineEntityCreate {
  type: "entity-create";
  entityType: string;
  name: string;
  path: string;
}

export interface ParsedInlineDiceRoll {
  type: "dice-roll";
  expression: string;
  result: number;
}

export interface ParsedInlineActionRoll {
  type: "action-roll";
  stat: string;
  action: number;
  statVal: number;
  /** Total adds (for backward compatibility) */
  adds: number;
  /** Individual adds with descriptions */
  addsDetail?: ActionMoveAdd[];
  vs1: number;
  vs2: number;
  burn?: {
    orig: number;
    reset: number;
  };
}

export type ParsedInlineMechanics =
  | ParsedInlineMove
  | ParsedInlineOracle
  | ParsedInlineProgress
  | ParsedInlineNoRoll
  | ParsedInlineTrackAdvance
  | ParsedInlineTrackCreate
  | ParsedInlineTrackComplete
  | ParsedInlineTrackReopen
  | ParsedInlineClockCreate
  | ParsedInlineClockAdvance
  | ParsedInlineClockResolve
  | ParsedInlineMeter
  | ParsedInlineBurn
  | ParsedInlineInitiative
  | ParsedInlineEntityCreate
  | ParsedInlineDiceRoll
  | ParsedInlineActionRoll;

const MOVE_PREFIX = "iv-move:";
const ORACLE_PREFIX = "iv-oracle:";
const PROGRESS_PREFIX = "iv-progress:";
const NOROLL_PREFIX = "iv-noroll:";

// New prefixes for tracks, clocks, meters, and entities
const TRACK_ADVANCE_PREFIX = "iv-track-advance:";
const TRACK_CREATE_PREFIX = "iv-track-create:";
const TRACK_COMPLETE_PREFIX = "iv-track-complete:";
const TRACK_REOPEN_PREFIX = "iv-track-reopen:";
const CLOCK_CREATE_PREFIX = "iv-clock-create:";
const CLOCK_ADVANCE_PREFIX = "iv-clock-advance:";
const CLOCK_RESOLVE_PREFIX = "iv-clock-resolve:";
const METER_PREFIX = "iv-meter:";
const BURN_PREFIX = "iv-burn:";
const INITIATIVE_PREFIX = "iv-initiative:";
const ENTITY_CREATE_PREFIX = "iv-entity-create:";
const DICE_ROLL_PREFIX = "iv-dice:";
const ACTION_ROLL_PREFIX = "iv-action-roll:";

/**
 * Parse the adds detail string.
 * Format: "1(desc1),2(desc2)" or "1,2" for adds without descriptions
 */
function parseAddsDetail(addsStr: string): ActionMoveAdd[] {
  const adds: ActionMoveAdd[] = [];
  // Match patterns like "1(description)" or just "1"
  const regex = /(-?\d+)(?:\(([^)]*)\))?/g;
  let match;
  while ((match = regex.exec(addsStr)) !== null) {
    const amount = parseInt(match[1], 10);
    const desc = match[2] || undefined;
    if (!isNaN(amount)) {
      adds.push({ amount, desc });
    }
  }
  return adds;
}

/**
 * Format adds detail array to string.
 * Format: "1(desc1),2(desc2)" or "1,2" for adds without descriptions
 */
function formatAddsDetail(adds: ActionMoveAdd[]): string {
  return adds
    .map(({ amount, desc }) => desc ? `${amount}(${desc})` : `${amount}`)
    .join(",");
}

/**
 * Parse inline move syntax.
 * Format: `iv-move:<name>|<stat>|<action>|<statVal>|<adds>|<vs1>|<vs2>[|<moveId>][|burn=<orig>:<reset>][|adds=<detail>]`
 */
export function parseMoveInline(text: string): ParsedInlineMove | null {
  if (!text.startsWith(MOVE_PREFIX)) return null;

  const content = text.slice(MOVE_PREFIX.length);
  const parts = content.split("|");

  if (parts.length < 7) return null;

  const [name, stat, actionStr, statValStr, addsStr, vs1Str, vs2Str, ...rest] =
    parts;

  const action = parseInt(actionStr, 10);
  const statVal = parseInt(statValStr, 10);
  const adds = parseInt(addsStr, 10);
  const vs1 = parseInt(vs1Str, 10);
  const vs2 = parseInt(vs2Str, 10);

  if ([action, statVal, adds, vs1, vs2].some(isNaN)) return null;

  let moveId: string | undefined;
  let burn: { orig: number; reset: number } | undefined;
  let addsDetail: ActionMoveAdd[] | undefined;

  for (const part of rest) {
    if (part.startsWith("burn=")) {
      const burnParts = part.slice(5).split(":");
      if (burnParts.length === 2) {
        const orig = parseInt(burnParts[0], 10);
        const reset = parseInt(burnParts[1], 10);
        if (!isNaN(orig) && !isNaN(reset)) {
          burn = { orig, reset };
        }
      }
    } else if (part.startsWith("adds=")) {
      addsDetail = parseAddsDetail(part.slice(5));
    } else if (part) {
      moveId = part;
    }
  }

  return {
    type: "move",
    name,
    stat,
    action,
    statVal,
    adds,
    addsDetail,
    vs1,
    vs2,
    moveId: moveId || undefined,
    burn,
  };
}

/**
 * Parse inline oracle syntax.
 * Format: `iv-oracle:<name>|<roll>|<result>[|<oracleId>][|cursed=<value>]`
 */
export function parseOracleInline(text: string): ParsedInlineOracle | null {
  if (!text.startsWith(ORACLE_PREFIX)) return null;

  const content = text.slice(ORACLE_PREFIX.length);
  const parts = content.split("|");

  if (parts.length < 3) return null;

  const [name, rollStr, result, ...rest] = parts;

  const roll = parseInt(rollStr, 10);
  if (isNaN(roll)) return null;

  let oracleId: string | undefined;
  let cursedRoll: number | undefined;

  for (const part of rest) {
    if (part.startsWith("cursed=")) {
      cursedRoll = parseInt(part.slice(7), 10);
    } else if (part && !part.startsWith("cursed=")) {
      oracleId = part;
    }
  }

  return {
    type: "oracle",
    name,
    roll,
    result,
    oracleId: oracleId || undefined,
    cursedRoll: isNaN(cursedRoll!) ? undefined : cursedRoll,
  };
}

/**
 * Parse inline progress roll syntax.
 * Format: `iv-progress:<trackName>|<score>|<vs1>|<vs2>[|<trackPath>]`
 */
export function parseProgressInline(text: string): ParsedInlineProgress | null {
  if (!text.startsWith(PROGRESS_PREFIX)) return null;

  const content = text.slice(PROGRESS_PREFIX.length);
  const parts = content.split("|");

  if (parts.length < 4) return null;

  const [trackName, scoreStr, vs1Str, vs2Str, trackPath] = parts;

  const score = parseInt(scoreStr, 10);
  const vs1 = parseInt(vs1Str, 10);
  const vs2 = parseInt(vs2Str, 10);

  if ([score, vs1, vs2].some(isNaN)) return null;

  return {
    type: "progress",
    trackName,
    trackPath: trackPath || undefined,
    score,
    vs1,
    vs2,
  };
}

/**
 * Parse inline no-roll move syntax.
 * Format: `iv-noroll:<name>[|<moveId>]`
 */
export function parseNoRollInline(text: string): ParsedInlineNoRoll | null {
  if (!text.startsWith(NOROLL_PREFIX)) return null;

  const content = text.slice(NOROLL_PREFIX.length);
  const parts = content.split("|");

  if (parts.length < 1 || !parts[0]) return null;

  const [name, moveId] = parts;

  return {
    type: "no-roll",
    name,
    moveId: moveId || undefined,
  };
}

/**
 * Parse any inline mechanics syntax.
 */
export function parseInlineMechanics(
  text: string,
): ParsedInlineMechanics | null {
  if (text.startsWith(MOVE_PREFIX)) {
    return parseMoveInline(text);
  }
  if (text.startsWith(ORACLE_PREFIX)) {
    return parseOracleInline(text);
  }
  if (text.startsWith(PROGRESS_PREFIX)) {
    return parseProgressInline(text);
  }
  if (text.startsWith(NOROLL_PREFIX)) {
    return parseNoRollInline(text);
  }
  if (text.startsWith(TRACK_ADVANCE_PREFIX)) {
    return parseTrackAdvanceInline(text);
  }
  if (text.startsWith(TRACK_CREATE_PREFIX)) {
    return parseTrackCreateInline(text);
  }
  if (text.startsWith(TRACK_COMPLETE_PREFIX)) {
    return parseTrackCompleteInline(text);
  }
  if (text.startsWith(TRACK_REOPEN_PREFIX)) {
    return parseTrackReopenInline(text);
  }
  if (text.startsWith(CLOCK_CREATE_PREFIX)) {
    return parseClockCreateInline(text);
  }
  if (text.startsWith(CLOCK_ADVANCE_PREFIX)) {
    return parseClockAdvanceInline(text);
  }
  if (text.startsWith(CLOCK_RESOLVE_PREFIX)) {
    return parseClockResolveInline(text);
  }
  if (text.startsWith(METER_PREFIX)) {
    return parseMeterInline(text);
  }
  if (text.startsWith(BURN_PREFIX)) {
    return parseBurnInline(text);
  }
  if (text.startsWith(INITIATIVE_PREFIX)) {
    return parseInitiativeInline(text);
  }
  if (text.startsWith(ENTITY_CREATE_PREFIX)) {
    return parseEntityCreateInline(text);
  }
  if (text.startsWith(DICE_ROLL_PREFIX)) {
    return parseDiceRollInline(text);
  }
  if (text.startsWith(ACTION_ROLL_PREFIX)) {
    return parseActionRollInline(text);
  }
  return null;
}

/**
 * Check if text is inline mechanics syntax.
 */
export function isInlineMechanics(text: string): boolean {
  return (
    text.startsWith(MOVE_PREFIX) ||
    text.startsWith(ORACLE_PREFIX) ||
    text.startsWith(PROGRESS_PREFIX) ||
    text.startsWith(NOROLL_PREFIX) ||
    text.startsWith(TRACK_ADVANCE_PREFIX) ||
    text.startsWith(TRACK_CREATE_PREFIX) ||
    text.startsWith(TRACK_COMPLETE_PREFIX) ||
    text.startsWith(TRACK_REOPEN_PREFIX) ||
    text.startsWith(CLOCK_CREATE_PREFIX) ||
    text.startsWith(CLOCK_ADVANCE_PREFIX) ||
    text.startsWith(CLOCK_RESOLVE_PREFIX) ||
    text.startsWith(METER_PREFIX) ||
    text.startsWith(BURN_PREFIX) ||
    text.startsWith(INITIATIVE_PREFIX) ||
    text.startsWith(ENTITY_CREATE_PREFIX) ||
    text.startsWith(DICE_ROLL_PREFIX) ||
    text.startsWith(ACTION_ROLL_PREFIX)
  );
}

/**
 * Convert an ActionMoveDescription to inline syntax.
 */
export function moveToInlineSyntax(move: ActionMoveDescription): string {
  // Handle both V1 (adds as number) and V2 (adds as array) formats
  const rawAdds = move.adds;
  let addsArray: ActionMoveAdd[];
  let totalAdds: number;
  
  if (typeof rawAdds === "number") {
    // V1 format: adds is just a number
    totalAdds = rawAdds;
    addsArray = totalAdds > 0 ? [{ amount: totalAdds }] : [];
  } else {
    // V2 format: adds is an array of { amount, desc? }
    addsArray = rawAdds ?? [];
    totalAdds = addsArray.reduce((a, b) => a + b.amount, 0);
  }
  
  const parts: (string | number)[] = [
    move.name,
    move.stat,
    move.action,
    move.statVal,
    totalAdds,
    move.challenge1,
    move.challenge2,
  ];
  if (move.id) parts.push(move.id);
  if (move.burn) parts.push(`burn=${move.burn.orig}:${move.burn.reset}`);
  // Include adds detail if there are any adds with descriptions
  if (addsArray.length > 0) {
    parts.push(`adds=${formatAddsDetail(addsArray)}`);
  }
  return `\`${MOVE_PREFIX}${parts.join("|")}\``;
}

/**
 * Extract both display name and path from a wiki-link.
 * Handles formats like: [[path/to/file.md|Display Name]] -> { name: "Display Name", path: "path/to/file.md" }
 * or [[path/to/file.md]] -> { name: "file", path: "path/to/file.md" }
 */
function extractNameAndPath(text: string): { name: string; path?: string } {
  // Check if it's a wiki-link
  const wikiLinkMatch = text.match(/^\[\[([^\]|]+)(?:\|([^\]]+))?\]\]$/);
  if (wikiLinkMatch) {
    const path = wikiLinkMatch[1];
    // If there's an alias (after |), use that as name
    if (wikiLinkMatch[2]) {
      return { name: wikiLinkMatch[2], path };
    }
    // Otherwise extract filename without extension from the path
    const filename = path.split("/").pop() || path;
    return { name: filename.replace(/\.md$/, ""), path };
  }
  return { name: text };
}

/**
 * Convert a ProgressMoveDescription to inline syntax.
 */
export function progressToInlineSyntax(move: ProgressMoveDescription): string {
  // Extract display name and path from wiki-link
  const { name: trackName, path: trackPath } = extractNameAndPath(move.progressTrack);
  const parts: (string | number)[] = [
    trackName,
    Math.floor(move.progressTicks / 4),
    move.challenge1,
    move.challenge2,
  ];
  // Add path if available (for linking to the track file)
  if (trackPath) {
    parts.push(trackPath);
  }
  return `\`${PROGRESS_PREFIX}${parts.join("|")}\``;
}

/**
 * Convert a NoRollMoveDescription to inline syntax.
 */
export function noRollToInlineSyntax(move: NoRollMoveDescription): string {
  const parts: string[] = [move.name];
  if (move.id) parts.push(move.id);
  return `\`${NOROLL_PREFIX}${parts.join("|")}\``;
}

/**
 * Convert a RollWrapper (oracle roll) to inline syntax.
 * Uses ownResult for the result text (which handles template substitution),
 * and strips any datasworn markdown links for clean display.
 */
export function oracleToInlineSyntax(roll: RollWrapper): string {
  // Use ownResult which handles template substitution for templated results
  // For Multi results (like "Roll twice"), we need to get the actual sub-roll results
  // Strip datasworn links to get clean text (e.g., "[Action](datasworn:...)" -> "Action")
  let resultText: string;
  
  // Check if this is a Multi result (like "Roll twice") where we need sub-roll results
  const hasNonTemplateSubrolls = Object.values(roll.subrolls).some(
    (subroll) => !subroll.inTemplate && subroll.rolls.length > 0
  );
  
  if (hasNonTemplateSubrolls) {
    // For Multi results, collect all the sub-roll results
    const subResults: string[] = [];
    for (const subroll of Object.values(roll.subrolls)) {
      if (!subroll.inTemplate) {
        for (const subrollWrapper of subroll.rolls) {
          subResults.push(stripDataswornLinks(subrollWrapper.simpleResult));
        }
      }
    }
    resultText = subResults.join(", ");
  } else {
    // For Simple or Templated results, ownResult handles it
    resultText = stripDataswornLinks(roll.ownResult);
  }
  
  const parts: (string | number)[] = [
    roll.oracle.name,
    roll.roll.roll,
    resultText,
  ];
  if (roll.oracle.id) parts.push(roll.oracle.id);
  if (roll.cursedRoll != null) parts.push(`cursed=${roll.cursedRoll}`);
  return `\`${ORACLE_PREFIX}${parts.join("|")}\``;
}

/**
 * Determine the outcome of a roll.
 */
export function determineOutcome(
  score: number,
  vs1: number,
  vs2: number,
): { outcome: "strong-hit" | "weak-hit" | "miss"; match: boolean } {
  const match = vs1 === vs2;

  if (score > vs1 && score > vs2) {
    return { outcome: "strong-hit", match };
  } else if (score > vs1 || score > vs2) {
    return { outcome: "weak-hit", match };
  } else {
    return { outcome: "miss", match };
  }
}

/**
 * Get human-readable outcome text.
 */
export function outcomeText(outcome: "strong-hit" | "weak-hit" | "miss"): string {
  switch (outcome) {
    case "strong-hit":
      return "Strong hit";
    case "weak-hit":
      return "Weak hit";
    case "miss":
      return "Miss";
  }
}

/**
 * Format adds for display (like mechanics blocks do).
 */
export function formatAddsForDisplay(addsDetail?: ActionMoveAdd[], totalAdds?: number): string {
  if (!addsDetail || addsDetail.length === 0) {
    return totalAdds !== undefined ? `${totalAdds}` : "0";
  }
  return addsDetail
    .map(({ amount, desc }) => `${amount}` + (desc ? ` (${desc})` : ""))
    .join(" + ");
}

// ============================================================================
// Track Parsing and Generation
// ============================================================================

/**
 * Parse inline track advance syntax.
 * Format: `iv-track-advance:<name>|<path>|<from>|<to>|<rank>|<steps>`
 */
export function parseTrackAdvanceInline(text: string): ParsedInlineTrackAdvance | null {
  if (!text.startsWith(TRACK_ADVANCE_PREFIX)) return null;

  const content = text.slice(TRACK_ADVANCE_PREFIX.length);
  const parts = content.split("|");

  if (parts.length < 6) return null;

  const [name, path, fromStr, toStr, rank, stepsStr] = parts;

  const from = parseInt(fromStr, 10);
  const to = parseInt(toStr, 10);
  const steps = parseInt(stepsStr, 10);

  if ([from, to, steps].some(isNaN)) return null;

  return {
    type: "track-advance",
    name,
    path,
    from,
    to,
    rank,
    steps,
  };
}

/**
 * Parse inline track create syntax.
 * Format: `iv-track-create:<name>|<path>`
 */
export function parseTrackCreateInline(text: string): ParsedInlineTrackCreate | null {
  if (!text.startsWith(TRACK_CREATE_PREFIX)) return null;

  const content = text.slice(TRACK_CREATE_PREFIX.length);
  const parts = content.split("|");

  if (parts.length < 2) return null;

  const [name, path] = parts;

  return {
    type: "track-create",
    name,
    path,
  };
}

/**
 * Parse inline track complete syntax.
 * Format: `iv-track-complete:<name>|<path>`
 */
export function parseTrackCompleteInline(text: string): ParsedInlineTrackComplete | null {
  if (!text.startsWith(TRACK_COMPLETE_PREFIX)) return null;

  const content = text.slice(TRACK_COMPLETE_PREFIX.length);
  const parts = content.split("|");

  if (parts.length < 2) return null;

  const [name, path] = parts;

  return {
    type: "track-complete",
    name,
    path,
  };
}

/**
 * Parse inline track reopen syntax.
 * Format: `iv-track-reopen:<name>|<path>`
 */
export function parseTrackReopenInline(text: string): ParsedInlineTrackReopen | null {
  if (!text.startsWith(TRACK_REOPEN_PREFIX)) return null;

  const content = text.slice(TRACK_REOPEN_PREFIX.length);
  const parts = content.split("|");

  if (parts.length < 2) return null;

  const [name, path] = parts;

  return {
    type: "track-reopen",
    name,
    path,
  };
}

/**
 * Generate inline syntax for track advance.
 */
export function trackAdvanceToInlineSyntax(
  name: string,
  path: string,
  from: number,
  to: number,
  rank: string,
  steps: number,
): string {
  const parts = [name, path, from, to, rank, steps];
  return `\`${TRACK_ADVANCE_PREFIX}${parts.join("|")}\``;
}

/**
 * Generate inline syntax for track create.
 */
export function trackCreateToInlineSyntax(name: string, path: string): string {
  const parts = [name, path];
  return `\`${TRACK_CREATE_PREFIX}${parts.join("|")}\``;
}

/**
 * Generate inline syntax for track complete.
 */
export function trackCompleteToInlineSyntax(name: string, path: string): string {
  const parts = [name, path];
  return `\`${TRACK_COMPLETE_PREFIX}${parts.join("|")}\``;
}

/**
 * Generate inline syntax for track reopen.
 */
export function trackReopenToInlineSyntax(name: string, path: string): string {
  const parts = [name, path];
  return `\`${TRACK_REOPEN_PREFIX}${parts.join("|")}\``;
}

// ============================================================================
// Clock Parsing and Generation
// ============================================================================

/**
 * Parse inline clock create syntax.
 * Format: `iv-clock-create:<name>|<path>`
 */
export function parseClockCreateInline(text: string): ParsedInlineClockCreate | null {
  if (!text.startsWith(CLOCK_CREATE_PREFIX)) return null;

  const content = text.slice(CLOCK_CREATE_PREFIX.length);
  const parts = content.split("|");

  if (parts.length < 2) return null;

  const [name, path] = parts;

  return {
    type: "clock-create",
    name,
    path,
  };
}

/**
 * Parse inline clock advance syntax.
 * Format: `iv-clock-advance:<name>|<path>|<from>|<to>|<segments>|<total>[|odds=<odds>:<roll>:<result>]`
 * Legacy format (backward compatible): `iv-clock-advance:<name>|<path>|<from>|<to>|<segments>[|odds=...]`
 */
export function parseClockAdvanceInline(text: string): ParsedInlineClockAdvance | null {
  if (!text.startsWith(CLOCK_ADVANCE_PREFIX)) return null;

  const content = text.slice(CLOCK_ADVANCE_PREFIX.length);
  const parts = content.split("|");

  if (parts.length < 5) return null;

  const [name, path, fromStr, toStr, segmentsStr, ...rest] = parts;

  const from = parseInt(fromStr, 10);
  const to = parseInt(toStr, 10);
  const segments = parseInt(segmentsStr, 10);

  if ([from, to, segments].some(isNaN)) return null;

  // Check if next part is total (a number) or odds/other
  let total: number;
  let remainingParts = rest;
  
  if (rest.length > 0 && !rest[0].startsWith("odds=") && !isNaN(parseInt(rest[0], 10))) {
    total = parseInt(rest[0], 10);
    remainingParts = rest.slice(1);
  } else {
    // Legacy format: total not provided, estimate from 'to' value
    // Default to common clock sizes based on current progress
    total = to <= 4 ? 4 : to <= 6 ? 6 : to <= 8 ? 8 : 10;
  }

  let oddsRoll: { odds: string; roll: number; result: "Yes" | "No" } | undefined;

  for (const part of remainingParts) {
    if (part.startsWith("odds=")) {
      const oddsParts = part.slice(5).split(":");
      if (oddsParts.length === 3) {
        const roll = parseInt(oddsParts[1], 10);
        const result = oddsParts[2] as "Yes" | "No";
        if (!isNaN(roll) && (result === "Yes" || result === "No")) {
          oddsRoll = { odds: oddsParts[0], roll, result };
        }
      }
    }
  }

  return {
    type: "clock-advance",
    name,
    path,
    from,
    to,
    segments,
    total,
    oddsRoll,
  };
}

/**
 * Parse inline clock resolve syntax.
 * Format: `iv-clock-resolve:<name>|<path>`
 */
export function parseClockResolveInline(text: string): ParsedInlineClockResolve | null {
  if (!text.startsWith(CLOCK_RESOLVE_PREFIX)) return null;

  const content = text.slice(CLOCK_RESOLVE_PREFIX.length);
  const parts = content.split("|");

  if (parts.length < 2) return null;

  const [name, path] = parts;

  return {
    type: "clock-resolve",
    name,
    path,
  };
}

/**
 * Generate inline syntax for clock create.
 */
export function clockCreateToInlineSyntax(name: string, path: string): string {
  const parts = [name, path];
  return `\`${CLOCK_CREATE_PREFIX}${parts.join("|")}\``;
}

/**
 * Generate inline syntax for clock advance.
 */
export function clockAdvanceToInlineSyntax(
  name: string,
  path: string,
  from: number,
  to: number,
  segments: number,
  total: number,
  oddsRoll?: { odds: string; roll: number; result: "Yes" | "No" },
): string {
  const parts: (string | number)[] = [name, path, from, to, segments, total];
  if (oddsRoll) {
    parts.push(`odds=${oddsRoll.odds}:${oddsRoll.roll}:${oddsRoll.result}`);
  }
  return `\`${CLOCK_ADVANCE_PREFIX}${parts.join("|")}\``;
}

/**
 * Generate inline syntax for clock resolve.
 */
export function clockResolveToInlineSyntax(name: string, path: string): string {
  const parts = [name, path];
  return `\`${CLOCK_RESOLVE_PREFIX}${parts.join("|")}\``;
}

// ============================================================================
// Meter Parsing and Generation
// ============================================================================

/**
 * Parse inline meter syntax.
 * Format: `iv-meter:<name>|<from>|<to>`
 */
export function parseMeterInline(text: string): ParsedInlineMeter | null {
  if (!text.startsWith(METER_PREFIX)) return null;

  const content = text.slice(METER_PREFIX.length);
  const parts = content.split("|");

  if (parts.length < 3) return null;

  const [name, fromStr, toStr] = parts;

  const from = parseInt(fromStr, 10);
  const to = parseInt(toStr, 10);

  if ([from, to].some(isNaN)) return null;

  return {
    type: "meter",
    name,
    from,
    to,
  };
}

/**
 * Parse inline burn syntax.
 * Format: `iv-burn:<from>|<to>`
 */
export function parseBurnInline(text: string): ParsedInlineBurn | null {
  if (!text.startsWith(BURN_PREFIX)) return null;

  const content = text.slice(BURN_PREFIX.length);
  const parts = content.split("|");

  if (parts.length < 2) return null;

  const [fromStr, toStr] = parts;

  const from = parseInt(fromStr, 10);
  const to = parseInt(toStr, 10);

  if ([from, to].some(isNaN)) return null;

  return {
    type: "burn",
    from,
    to,
  };
}

/**
 * Parse inline initiative syntax.
 * Format: `iv-initiative:<label>|<from>|<to>` or `iv-initiative:<label>||<to>` or `iv-initiative:<label>|<from>|`
 */
export function parseInitiativeInline(text: string): ParsedInlineInitiative | null {
  if (!text.startsWith(INITIATIVE_PREFIX)) return null;

  const content = text.slice(INITIATIVE_PREFIX.length);
  const parts = content.split("|");

  if (parts.length < 1 || !parts[0]) return null;

  const [label, from, to] = parts;

  return {
    type: "initiative",
    label,
    from: from || undefined,
    to: to || undefined,
  };
}

/**
 * Generate inline syntax for meter change.
 */
export function meterToInlineSyntax(name: string, from: number, to: number): string {
  const parts = [name, from, to];
  return `\`${METER_PREFIX}${parts.join("|")}\``;
}

/**
 * Generate inline syntax for momentum burn.
 */
export function burnToInlineSyntax(from: number, to: number): string {
  const parts = [from, to];
  return `\`${BURN_PREFIX}${parts.join("|")}\``;
}

/**
 * Generate inline syntax for initiative change.
 */
export function initiativeToInlineSyntax(
  label: string,
  from: string | undefined,
  to: string | undefined,
): string {
  const parts = [label, from ?? "", to ?? ""];
  return `\`${INITIATIVE_PREFIX}${parts.join("|")}\``;
}

// ============================================================================
// Entity Parsing and Generation
// ============================================================================

/**
 * Parse inline entity create syntax.
 * Format: `iv-entity-create:<entityType>|<name>|<path>`
 */
export function parseEntityCreateInline(text: string): ParsedInlineEntityCreate | null {
  if (!text.startsWith(ENTITY_CREATE_PREFIX)) return null;

  const content = text.slice(ENTITY_CREATE_PREFIX.length);
  const parts = content.split("|");

  if (parts.length < 3) return null;

  const [entityType, name, path] = parts;

  return {
    type: "entity-create",
    entityType,
    name,
    path,
  };
}

/**
 * Generate inline syntax for entity creation.
 */
export function entityCreateToInlineSyntax(
  entityType: string,
  name: string,
  path: string,
): string {
  const parts = [entityType, name, path];
  return `\`${ENTITY_CREATE_PREFIX}${parts.join("|")}\``;
}

// ============================================================================
// Dice Roll Parsing and Generation
// ============================================================================

/**
 * Parse inline dice roll syntax.
 * Format: `iv-dice:<expression>|<result>`
 */
export function parseDiceRollInline(text: string): ParsedInlineDiceRoll | null {
  if (!text.startsWith(DICE_ROLL_PREFIX)) return null;

  const content = text.slice(DICE_ROLL_PREFIX.length);
  const parts = content.split("|");

  if (parts.length < 2) return null;

  const [expression, resultStr] = parts;

  const result = parseInt(resultStr, 10);
  if (isNaN(result)) return null;

  return {
    type: "dice-roll",
    expression,
    result,
  };
}

/**
 * Generate inline syntax for dice roll.
 */
export function diceRollToInlineSyntax(expression: string, result: number): string {
  const parts = [expression, result];
  return `\`${DICE_ROLL_PREFIX}${parts.join("|")}\``;
}

// ============================================================================
// Action Roll Parsing and Generation
// ============================================================================

/**
 * Parse inline action roll syntax.
 * Format: `iv-action-roll:<stat>|<action>|<statVal>|<adds>|<vs1>|<vs2>[|burn=<orig>:<reset>][|adds=<detail>]`
 */
export function parseActionRollInline(text: string): ParsedInlineActionRoll | null {
  if (!text.startsWith(ACTION_ROLL_PREFIX)) return null;

  const content = text.slice(ACTION_ROLL_PREFIX.length);
  const parts = content.split("|");

  if (parts.length < 6) return null;

  const [stat, actionStr, statValStr, addsStr, vs1Str, vs2Str, ...rest] = parts;

  const action = parseInt(actionStr, 10);
  const statVal = parseInt(statValStr, 10);
  const adds = parseInt(addsStr, 10);
  const vs1 = parseInt(vs1Str, 10);
  const vs2 = parseInt(vs2Str, 10);

  if ([action, statVal, adds, vs1, vs2].some(isNaN)) return null;

  let burn: { orig: number; reset: number } | undefined;
  let addsDetail: ActionMoveAdd[] | undefined;

  for (const part of rest) {
    if (part.startsWith("burn=")) {
      const burnParts = part.slice(5).split(":");
      if (burnParts.length === 2) {
        const orig = parseInt(burnParts[0], 10);
        const reset = parseInt(burnParts[1], 10);
        if (!isNaN(orig) && !isNaN(reset)) {
          burn = { orig, reset };
        }
      }
    } else if (part.startsWith("adds=")) {
      addsDetail = parseAddsDetail(part.slice(5));
    }
  }

  return {
    type: "action-roll",
    stat,
    action,
    statVal,
    adds,
    addsDetail,
    vs1,
    vs2,
    burn,
  };
}

/**
 * Generate inline syntax for action roll.
 */
export function actionRollToInlineSyntax(
  stat: string,
  action: number,
  statVal: number,
  adds: number,
  vs1: number,
  vs2: number,
  addsDetail?: ActionMoveAdd[],
  burn?: { orig: number; reset: number },
): string {
  const parts: (string | number)[] = [stat, action, statVal, adds, vs1, vs2];
  if (burn) parts.push(`burn=${burn.orig}:${burn.reset}`);
  if (addsDetail && addsDetail.length > 0) {
    parts.push(`adds=${formatAddsDetail(addsDetail)}`);
  }
  return `\`${ACTION_ROLL_PREFIX}${parts.join("|")}\``;
}
