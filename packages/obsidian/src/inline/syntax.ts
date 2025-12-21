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
  score: number;
  vs1: number;
  vs2: number;
}

export interface ParsedInlineNoRoll {
  type: "no-roll";
  name: string;
  moveId?: string;
}

export type ParsedInlineMechanics =
  | ParsedInlineMove
  | ParsedInlineOracle
  | ParsedInlineProgress
  | ParsedInlineNoRoll;

const MOVE_PREFIX = "iv-move:";
const ORACLE_PREFIX = "iv-oracle:";
const PROGRESS_PREFIX = "iv-progress:";
const NOROLL_PREFIX = "iv-noroll:";

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
 * Format: `iv-progress:<trackName>|<score>|<vs1>|<vs2>`
 */
export function parseProgressInline(text: string): ParsedInlineProgress | null {
  if (!text.startsWith(PROGRESS_PREFIX)) return null;

  const content = text.slice(PROGRESS_PREFIX.length);
  const parts = content.split("|");

  if (parts.length < 4) return null;

  const [trackName, scoreStr, vs1Str, vs2Str] = parts;

  const score = parseInt(scoreStr, 10);
  const vs1 = parseInt(vs1Str, 10);
  const vs2 = parseInt(vs2Str, 10);

  if ([score, vs1, vs2].some(isNaN)) return null;

  return {
    type: "progress",
    trackName,
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
    text.startsWith(NOROLL_PREFIX)
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
 * Extract display name from a wiki-link or return the string as-is.
 * Handles formats like: [[path/to/file.md|Display Name]] -> "Display Name"
 * or [[path/to/file.md]] -> "file" (filename without extension)
 */
function extractDisplayName(text: string): string {
  // Check if it's a wiki-link
  const wikiLinkMatch = text.match(/^\[\[([^\]|]+)(?:\|([^\]]+))?\]\]$/);
  if (wikiLinkMatch) {
    // If there's an alias (after |), use that
    if (wikiLinkMatch[2]) {
      return wikiLinkMatch[2];
    }
    // Otherwise extract filename without extension from the path
    const path = wikiLinkMatch[1];
    const filename = path.split("/").pop() || path;
    return filename.replace(/\.md$/, "");
  }
  return text;
}

/**
 * Convert a ProgressMoveDescription to inline syntax.
 */
export function progressToInlineSyntax(move: ProgressMoveDescription): string {
  // Extract display name from wiki-link to avoid | delimiter conflicts
  const trackName = extractDisplayName(move.progressTrack);
  const parts = [
    trackName,
    Math.floor(move.progressTicks / 4),
    move.challenge1,
    move.challenge2,
  ];
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
 */
export function oracleToInlineSyntax(roll: RollWrapper): string {
  const parts: (string | number)[] = [
    roll.oracle.name,
    roll.roll.roll,
    roll.ownResult,
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
