/**
 * Tests for inline mechanics syntax parsing and generation.
 */

import { describe, expect, it } from "vitest";
import {
  parseMoveInline,
  parseOracleInline,
  parseProgressInline,
  parseNoRollInline,
  parseInlineMechanics,
  isInlineMechanics,
  determineOutcome,
  outcomeText,
  formatAddsForDisplay,
  progressToInlineSyntax,
  noRollToInlineSyntax,
  moveToInlineSyntax,
} from "./syntax";
import { ActionMoveDescription } from "moves/desc";

describe("parseMoveInline", () => {
  it("parses basic move syntax", () => {
    const result = parseMoveInline("iv-move:Strike|Iron|4|2|1|3|7");
    expect(result).toEqual({
      type: "move",
      name: "Strike",
      stat: "Iron",
      action: 4,
      statVal: 2,
      adds: 1,
      addsDetail: undefined,
      vs1: 3,
      vs2: 7,
      moveId: undefined,
      burn: undefined,
    });
  });

  it("parses move with moveId", () => {
    const result = parseMoveInline(
      "iv-move:Strike|Iron|4|2|1|3|7|move:starforged/combat/strike",
    );
    expect(result?.moveId).toBe("move:starforged/combat/strike");
  });

  it("parses move with burn", () => {
    const result = parseMoveInline(
      "iv-move:Face Danger|Shadow|3|2|0|5|9|move:starforged/adventure/face_danger|burn=8:2",
    );
    expect(result?.burn).toEqual({ orig: 8, reset: 2 });
  });

  it("parses move with adds detail", () => {
    const result = parseMoveInline(
      "iv-move:Strike|Iron|4|2|3|3|7|move:starforged/combat/strike|adds=2(Asset),1(Companion)",
    );
    expect(result?.addsDetail).toEqual([
      { amount: 2, desc: "Asset" },
      { amount: 1, desc: "Companion" },
    ]);
  });

  it("parses move with adds detail without descriptions", () => {
    const result = parseMoveInline(
      "iv-move:Strike|Iron|4|2|3|3|7|move:starforged/combat/strike|adds=2,1",
    );
    expect(result?.addsDetail).toEqual([
      { amount: 2, desc: undefined },
      { amount: 1, desc: undefined },
    ]);
  });

  it("parses move with burn and adds", () => {
    const result = parseMoveInline(
      "iv-move:Strike|Iron|4|2|3|3|7|move:starforged/combat/strike|burn=8:2|adds=2(Asset),1",
    );
    expect(result?.burn).toEqual({ orig: 8, reset: 2 });
    expect(result?.addsDetail).toEqual([
      { amount: 2, desc: "Asset" },
      { amount: 1, desc: undefined },
    ]);
  });

  it("returns null for invalid syntax", () => {
    expect(parseMoveInline("not a move")).toBeNull();
    expect(parseMoveInline("iv-move:Strike|Iron")).toBeNull();
    expect(parseMoveInline("iv-move:Strike|Iron|a|2|1|3|7")).toBeNull();
  });

  it("returns null for non-move prefix", () => {
    expect(parseMoveInline("iv-oracle:Action|45|Bolster")).toBeNull();
  });
});

describe("parseOracleInline", () => {
  it("parses basic oracle syntax", () => {
    const result = parseOracleInline("iv-oracle:Action|45|Bolster");
    expect(result).toEqual({
      type: "oracle",
      name: "Action",
      roll: 45,
      result: "Bolster",
      oracleId: undefined,
      cursedRoll: undefined,
    });
  });

  it("parses oracle with oracleId", () => {
    const result = parseOracleInline(
      "iv-oracle:Action|45|Bolster|oracle:starforged/oracles/core/action",
    );
    expect(result?.oracleId).toBe("oracle:starforged/oracles/core/action");
  });

  it("parses oracle with cursed die", () => {
    const result = parseOracleInline(
      "iv-oracle:Action|45|Bolster|oracle:starforged/oracles/core/action|cursed=7",
    );
    expect(result?.cursedRoll).toBe(7);
  });

  it("returns null for invalid syntax", () => {
    expect(parseOracleInline("not an oracle")).toBeNull();
    expect(parseOracleInline("iv-oracle:Action")).toBeNull();
    expect(parseOracleInline("iv-oracle:Action|abc|Bolster")).toBeNull();
  });
});

describe("parseProgressInline", () => {
  it("parses progress syntax with move name and track name", () => {
    const result = parseProgressInline(
      "iv-progress:Fulfill Your Vow|My Vow|7|3|9",
    );
    expect(result).toEqual({
      type: "progress",
      moveName: "Fulfill Your Vow",
      moveId: undefined,
      trackName: "My Vow",
      trackPath: undefined,
      score: 7,
      vs1: 3,
      vs2: 9,
    });
  });

  it("parses progress syntax with move name, track name, and path", () => {
    const result = parseProgressInline(
      "iv-progress:Fulfill Your Vow|My Vow|7|3|9|Campaign/Progress/My Vow.md",
    );
    expect(result).toEqual({
      type: "progress",
      moveName: "Fulfill Your Vow",
      moveId: undefined,
      trackName: "My Vow",
      trackPath: "Campaign/Progress/My Vow.md",
      score: 7,
      vs1: 3,
      vs2: 9,
    });
  });

  it("parses progress syntax with move name, track name, path, and move ID", () => {
    const result = parseProgressInline(
      "iv-progress:Fulfill Your Vow|My Vow|7|3|9|Campaign/Progress/My Vow.md|move:starforged/quest/fulfill_your_vow",
    );
    expect(result).toEqual({
      type: "progress",
      moveName: "Fulfill Your Vow",
      moveId: "move:starforged/quest/fulfill_your_vow",
      trackName: "My Vow",
      trackPath: "Campaign/Progress/My Vow.md",
      score: 7,
      vs1: 3,
      vs2: 9,
    });
  });

  it("parses progress syntax with move name, track name, and move ID (no path)", () => {
    const result = parseProgressInline(
      "iv-progress:Fulfill Your Vow|My Vow|7|3|9|move:starforged/quest/fulfill_your_vow",
    );
    expect(result).toEqual({
      type: "progress",
      moveName: "Fulfill Your Vow",
      moveId: "move:starforged/quest/fulfill_your_vow",
      trackName: "My Vow",
      trackPath: undefined,
      score: 7,
      vs1: 3,
      vs2: 9,
    });
  });

  it("returns null for invalid syntax", () => {
    expect(parseProgressInline("not a progress")).toBeNull();
    expect(parseProgressInline("iv-progress:Move|Track|7")).toBeNull();
    expect(parseProgressInline("iv-progress:Move|Track|a|3|9")).toBeNull();
  });
});

describe("parseNoRollInline", () => {
  it("parses basic no-roll syntax", () => {
    const result = parseNoRollInline("iv-noroll:Begin a Session");
    expect(result).toEqual({
      type: "no-roll",
      name: "Begin a Session",
      moveId: undefined,
    });
  });

  it("parses no-roll with moveId", () => {
    const result = parseNoRollInline(
      "iv-noroll:Begin a Session|move:starforged/session/begin_a_session",
    );
    expect(result).toEqual({
      type: "no-roll",
      name: "Begin a Session",
      moveId: "move:starforged/session/begin_a_session",
    });
  });

  it("returns null for invalid syntax", () => {
    expect(parseNoRollInline("not a no-roll")).toBeNull();
    expect(parseNoRollInline("iv-noroll:")).toBeNull();
  });
});

describe("parseInlineMechanics", () => {
  it("parses moves", () => {
    const result = parseInlineMechanics("iv-move:Strike|Iron|4|2|1|3|7");
    expect(result?.type).toBe("move");
  });

  it("parses oracles", () => {
    const result = parseInlineMechanics("iv-oracle:Action|45|Bolster");
    expect(result?.type).toBe("oracle");
  });

  it("parses progress", () => {
    const result = parseInlineMechanics(
      "iv-progress:Fulfill Your Vow|Track|7|3|9",
    );
    expect(result?.type).toBe("progress");
  });

  it("parses no-roll", () => {
    const result = parseInlineMechanics("iv-noroll:Begin a Session");
    expect(result?.type).toBe("no-roll");
  });

  it("returns null for unknown syntax", () => {
    expect(parseInlineMechanics("unknown")).toBeNull();
  });
});

describe("isInlineMechanics", () => {
  it("returns true for move syntax", () => {
    expect(isInlineMechanics("iv-move:Strike|Iron|4|2|1|3|7")).toBe(true);
  });

  it("returns true for oracle syntax", () => {
    expect(isInlineMechanics("iv-oracle:Action|45|Bolster")).toBe(true);
  });

  it("returns true for progress syntax", () => {
    expect(isInlineMechanics("iv-progress:Track|7|3|9")).toBe(true);
  });

  it("returns true for no-roll syntax", () => {
    expect(isInlineMechanics("iv-noroll:Begin a Session")).toBe(true);
  });

  it("returns false for other text", () => {
    expect(isInlineMechanics("regular code")).toBe(false);
    expect(isInlineMechanics("")).toBe(false);
  });
});

describe("determineOutcome", () => {
  it("returns strong hit when score beats both dice", () => {
    expect(determineOutcome(8, 3, 5)).toEqual({
      outcome: "strong-hit",
      match: false,
    });
  });

  it("returns weak hit when score beats one die", () => {
    expect(determineOutcome(5, 3, 7)).toEqual({
      outcome: "weak-hit",
      match: false,
    });
  });

  it("returns miss when score beats neither die", () => {
    expect(determineOutcome(2, 3, 5)).toEqual({
      outcome: "miss",
      match: false,
    });
  });

  it("detects match when dice are equal", () => {
    expect(determineOutcome(8, 5, 5)).toEqual({
      outcome: "strong-hit",
      match: true,
    });
    expect(determineOutcome(2, 5, 5)).toEqual({
      outcome: "miss",
      match: true,
    });
  });

  it("handles ties correctly (tie goes to challenge die)", () => {
    // Score of 5 vs 5|3 - ties with first die, beats second = weak hit
    expect(determineOutcome(5, 5, 3)).toEqual({
      outcome: "weak-hit",
      match: false,
    });
    // Score of 5 vs 5|5 - ties with both = miss with match
    expect(determineOutcome(5, 5, 5)).toEqual({
      outcome: "miss",
      match: true,
    });
  });
});

describe("outcomeText", () => {
  it("returns correct text for each outcome", () => {
    expect(outcomeText("strong-hit")).toBe("Strong hit");
    expect(outcomeText("weak-hit")).toBe("Weak hit");
    expect(outcomeText("miss")).toBe("Miss");
  });
});

describe("formatAddsForDisplay", () => {
  it("returns total adds when no detail provided", () => {
    expect(formatAddsForDisplay(undefined, 3)).toBe("3");
  });

  it("returns 0 when no adds", () => {
    expect(formatAddsForDisplay(undefined, undefined)).toBe("0");
    expect(formatAddsForDisplay([], undefined)).toBe("0");
  });

  it("formats adds with descriptions", () => {
    expect(
      formatAddsForDisplay([
        { amount: 2, desc: "Asset" },
        { amount: 1, desc: "Companion" },
      ]),
    ).toBe("2 (Asset) + 1 (Companion)");
  });

  it("formats adds without descriptions", () => {
    expect(formatAddsForDisplay([{ amount: 2 }, { amount: 1 }])).toBe("2 + 1");
  });

  it("formats mixed adds", () => {
    expect(
      formatAddsForDisplay([{ amount: 2, desc: "Asset" }, { amount: 1 }]),
    ).toBe("2 (Asset) + 1");
  });
});

describe("progressToInlineSyntax", () => {
  it("generates syntax with move name, track name, and path from wiki-link with alias", () => {
    const move = {
      name: "Fulfill Your Vow",
      progressTrack: "[[Campaign/Progress/My Vow.md|My Vow]]",
      progressTicks: 28,
      challenge1: 3,
      challenge2: 9,
    };
    const result = progressToInlineSyntax(move);
    expect(result).toBe(
      "`iv-progress:Fulfill Your Vow|My Vow|7|3|9|Campaign/Progress/My Vow.md`",
    );
  });

  it("generates syntax with move name, track name, and path from wiki-link without alias", () => {
    const move = {
      name: "Fulfill Your Vow",
      progressTrack: "[[Campaign/Progress/My Vow.md]]",
      progressTicks: 28,
      challenge1: 3,
      challenge2: 9,
    };
    const result = progressToInlineSyntax(move);
    expect(result).toBe(
      "`iv-progress:Fulfill Your Vow|My Vow|7|3|9|Campaign/Progress/My Vow.md`",
    );
  });

  it("generates syntax with move name and track name (no path)", () => {
    const move = {
      name: "Fulfill Your Vow",
      progressTrack: "My Vow",
      progressTicks: 28,
      challenge1: 3,
      challenge2: 9,
    };
    const result = progressToInlineSyntax(move);
    expect(result).toBe("`iv-progress:Fulfill Your Vow|My Vow|7|3|9`");
  });

  it("generates syntax with move name, track name, path, and move ID", () => {
    const move = {
      id: "move:starforged/quest/fulfill_your_vow",
      name: "Fulfill Your Vow",
      progressTrack: "[[Campaign/Progress/My Vow.md|My Vow]]",
      progressTicks: 28,
      challenge1: 3,
      challenge2: 9,
    };
    const result = progressToInlineSyntax(move);
    expect(result).toBe(
      "`iv-progress:Fulfill Your Vow|My Vow|7|3|9|Campaign/Progress/My Vow.md|move:starforged/quest/fulfill_your_vow`",
    );
  });

  it("generates syntax with move name, track name, and move ID (no path)", () => {
    const move = {
      id: "move:starforged/quest/fulfill_your_vow",
      name: "Fulfill Your Vow",
      progressTrack: "My Vow",
      progressTicks: 28,
      challenge1: 3,
      challenge2: 9,
    };
    const result = progressToInlineSyntax(move);
    expect(result).toBe(
      "`iv-progress:Fulfill Your Vow|My Vow|7|3|9|move:starforged/quest/fulfill_your_vow`",
    );
  });
});

describe("noRollToInlineSyntax", () => {
  it("generates syntax without moveId", () => {
    const move = {
      name: "Begin a Session",
    };
    const result = noRollToInlineSyntax(move);
    expect(result).toBe("`iv-noroll:Begin a Session`");
  });

  it("generates syntax with moveId", () => {
    const move = {
      name: "Begin a Session",
      id: "move:starforged/session/begin_a_session",
    };
    const result = noRollToInlineSyntax(move);
    expect(result).toBe(
      "`iv-noroll:Begin a Session|move:starforged/session/begin_a_session`",
    );
  });
});

describe("moveToInlineSyntax", () => {
  it("generates basic move syntax with V2 adds format", () => {
    const move: ActionMoveDescription = {
      name: "Strike",
      stat: "Iron",
      action: 4,
      statVal: 2,
      adds: [{ amount: 1 }],
      challenge1: 3,
      challenge2: 7,
    };
    const result = moveToInlineSyntax(move);
    expect(result).toBe("`iv-move:Strike|Iron|4|2|1|3|7|adds=1`");
  });

  it("generates move syntax with moveId", () => {
    const move: ActionMoveDescription = {
      name: "Strike",
      stat: "Iron",
      action: 4,
      statVal: 2,
      adds: [],
      challenge1: 3,
      challenge2: 7,
      id: "move:starforged/combat/strike",
    };
    const result = moveToInlineSyntax(move);
    expect(result).toBe(
      "`iv-move:Strike|Iron|4|2|0|3|7|move:starforged/combat/strike`",
    );
  });

  it("generates move syntax with burn", () => {
    const move: ActionMoveDescription = {
      name: "Face Danger",
      stat: "Shadow",
      action: 3,
      statVal: 2,
      adds: [],
      challenge1: 5,
      challenge2: 9,
      burn: { orig: 8, reset: 2 },
    };
    const result = moveToInlineSyntax(move);
    expect(result).toBe("`iv-move:Face Danger|Shadow|3|2|0|5|9|burn=8:2`");
  });

  it("generates move syntax with adds detail including descriptions", () => {
    const move: ActionMoveDescription = {
      name: "Strike",
      stat: "Iron",
      action: 4,
      statVal: 2,
      adds: [
        { amount: 2, desc: "Asset" },
        { amount: 1, desc: "Companion" },
      ],
      challenge1: 3,
      challenge2: 7,
    };
    const result = moveToInlineSyntax(move);
    expect(result).toBe(
      "`iv-move:Strike|Iron|4|2|3|3|7|adds=2(Asset),1(Companion)`",
    );
  });

  it("generates move syntax with all options", () => {
    const move: ActionMoveDescription = {
      name: "Strike",
      stat: "Iron",
      action: 4,
      statVal: 2,
      adds: [{ amount: 2, desc: "Asset" }],
      challenge1: 3,
      challenge2: 7,
      id: "move:starforged/combat/strike",
      burn: { orig: 8, reset: 2 },
    };
    const result = moveToInlineSyntax(move);
    expect(result).toBe(
      "`iv-move:Strike|Iron|4|2|2|3|7|move:starforged/combat/strike|burn=8:2|adds=2(Asset)`",
    );
  });

  it("handles empty adds array", () => {
    const move: ActionMoveDescription = {
      name: "Strike",
      stat: "Iron",
      action: 4,
      statVal: 2,
      adds: [],
      challenge1: 3,
      challenge2: 7,
    };
    const result = moveToInlineSyntax(move);
    expect(result).toBe("`iv-move:Strike|Iron|4|2|0|3|7`");
  });
});

// ============================================================================
// Track Parsing Tests
// ============================================================================

import {
  parseTrackAdvanceInline,
  parseTrackCreateInline,
  parseTrackCompleteInline,
  parseTrackReopenInline,
  trackAdvanceToInlineSyntax,
  trackCreateToInlineSyntax,
  trackCompleteToInlineSyntax,
  trackReopenToInlineSyntax,
  parseClockCreateInline,
  parseClockAdvanceInline,
  parseClockResolveInline,
  clockCreateToInlineSyntax,
  clockAdvanceToInlineSyntax,
  clockResolveToInlineSyntax,
  parseMeterInline,
  parseBurnInline,
  parseInitiativeInline,
  meterToInlineSyntax,
  burnToInlineSyntax,
  initiativeToInlineSyntax,
  parseEntityCreateInline,
  entityCreateToInlineSyntax,
} from "./syntax";

describe("parseTrackAdvanceInline", () => {
  it("parses basic track advance syntax", () => {
    const result = parseTrackAdvanceInline(
      "iv-track-advance:My Vow|Progress/My Vow.md|4|8|dangerous|2",
    );
    expect(result).toEqual({
      type: "track-advance",
      name: "My Vow",
      path: "Progress/My Vow.md",
      from: 4,
      to: 8,
      rank: "dangerous",
      steps: 2,
    });
  });

  it("returns null for invalid syntax", () => {
    expect(parseTrackAdvanceInline("not a track")).toBeNull();
    expect(parseTrackAdvanceInline("iv-track-advance:Name|Path")).toBeNull();
    expect(
      parseTrackAdvanceInline("iv-track-advance:Name|Path|a|8|rank|2"),
    ).toBeNull();
  });
});

describe("parseTrackCreateInline", () => {
  it("parses basic track create syntax", () => {
    const result = parseTrackCreateInline(
      "iv-track-create:My Vow|Progress/My Vow.md",
    );
    expect(result).toEqual({
      type: "track-create",
      name: "My Vow",
      path: "Progress/My Vow.md",
    });
  });

  it("returns null for invalid syntax", () => {
    expect(parseTrackCreateInline("not a track")).toBeNull();
    expect(parseTrackCreateInline("iv-track-create:Name")).toBeNull();
  });
});

describe("parseTrackCompleteInline", () => {
  it("parses basic track complete syntax", () => {
    const result = parseTrackCompleteInline(
      "iv-track-complete:My Vow|Progress/My Vow.md",
    );
    expect(result).toEqual({
      type: "track-complete",
      name: "My Vow",
      path: "Progress/My Vow.md",
    });
  });

  it("returns null for invalid syntax", () => {
    expect(parseTrackCompleteInline("not a track")).toBeNull();
  });
});

describe("parseTrackReopenInline", () => {
  it("parses basic track reopen syntax", () => {
    const result = parseTrackReopenInline(
      "iv-track-reopen:My Vow|Progress/My Vow.md",
    );
    expect(result).toEqual({
      type: "track-reopen",
      name: "My Vow",
      path: "Progress/My Vow.md",
    });
  });

  it("returns null for invalid syntax", () => {
    expect(parseTrackReopenInline("not a track")).toBeNull();
  });
});

describe("trackToInlineSyntax", () => {
  it("generates track advance syntax", () => {
    const result = trackAdvanceToInlineSyntax(
      "My Vow",
      "Progress/My Vow.md",
      4,
      8,
      "dangerous",
      2,
    );
    expect(result).toBe(
      "`iv-track-advance:My Vow|Progress/My Vow.md|4|8|dangerous|2`",
    );
  });

  it("generates track create syntax", () => {
    const result = trackCreateToInlineSyntax("My Vow", "Progress/My Vow.md");
    expect(result).toBe("`iv-track-create:My Vow|Progress/My Vow.md`");
  });

  it("generates track complete syntax", () => {
    const result = trackCompleteToInlineSyntax("My Vow", "Progress/My Vow.md");
    expect(result).toBe("`iv-track-complete:My Vow|Progress/My Vow.md`");
  });

  it("generates track reopen syntax", () => {
    const result = trackReopenToInlineSyntax("My Vow", "Progress/My Vow.md");
    expect(result).toBe("`iv-track-reopen:My Vow|Progress/My Vow.md`");
  });
});

// ============================================================================
// Clock Parsing Tests
// ============================================================================

describe("parseClockCreateInline", () => {
  it("parses basic clock create syntax", () => {
    const result = parseClockCreateInline(
      "iv-clock-create:Danger Approaches|Clocks/Danger.md",
    );
    expect(result).toEqual({
      type: "clock-create",
      name: "Danger Approaches",
      path: "Clocks/Danger.md",
    });
  });

  it("returns null for invalid syntax", () => {
    expect(parseClockCreateInline("not a clock")).toBeNull();
    expect(parseClockCreateInline("iv-clock-create:Name")).toBeNull();
  });
});

describe("parseClockAdvanceInline", () => {
  it("parses clock advance syntax with total", () => {
    const result = parseClockAdvanceInline(
      "iv-clock-advance:Danger|Clocks/Danger.md|2|4|2|6",
    );
    expect(result).toEqual({
      type: "clock-advance",
      name: "Danger",
      path: "Clocks/Danger.md",
      from: 2,
      to: 4,
      segments: 2,
      total: 6,
      oddsRoll: undefined,
    });
  });

  it("parses legacy clock advance syntax without total", () => {
    // Legacy format: segments was the 5th field, no total
    const result = parseClockAdvanceInline(
      "iv-clock-advance:Danger|Clocks/Danger.md|2|4|2",
    );
    expect(result).toEqual({
      type: "clock-advance",
      name: "Danger",
      path: "Clocks/Danger.md",
      from: 2,
      to: 4,
      segments: 2,
      total: 4, // Estimated from 'to' value
      oddsRoll: undefined,
    });
  });

  it("parses clock advance with odds roll", () => {
    const result = parseClockAdvanceInline(
      "iv-clock-advance:Danger|Clocks/Danger.md|2|4|2|6|odds=Likely:45:Yes",
    );
    expect(result?.oddsRoll).toEqual({
      odds: "Likely",
      roll: 45,
      result: "Yes",
    });
    expect(result?.total).toBe(6);
  });

  it("parses clock advance with failed odds roll", () => {
    const result = parseClockAdvanceInline(
      "iv-clock-advance:Danger|Clocks/Danger.md|2|2|2|6|odds=Unlikely:85:No",
    );
    expect(result?.oddsRoll).toEqual({
      odds: "Unlikely",
      roll: 85,
      result: "No",
    });
  });

  it("returns null for invalid syntax", () => {
    expect(parseClockAdvanceInline("not a clock")).toBeNull();
    expect(parseClockAdvanceInline("iv-clock-advance:Name|Path")).toBeNull();
  });
});

describe("parseClockResolveInline", () => {
  it("parses basic clock resolve syntax", () => {
    const result = parseClockResolveInline(
      "iv-clock-resolve:Danger|Clocks/Danger.md",
    );
    expect(result).toEqual({
      type: "clock-resolve",
      name: "Danger",
      path: "Clocks/Danger.md",
    });
  });

  it("returns null for invalid syntax", () => {
    expect(parseClockResolveInline("not a clock")).toBeNull();
  });
});

describe("clockToInlineSyntax", () => {
  it("generates clock create syntax", () => {
    const result = clockCreateToInlineSyntax("Danger", "Clocks/Danger.md");
    expect(result).toBe("`iv-clock-create:Danger|Clocks/Danger.md`");
  });

  it("generates clock advance syntax without odds", () => {
    const result = clockAdvanceToInlineSyntax(
      "Danger",
      "Clocks/Danger.md",
      2,
      4,
      2,
      6,
    );
    expect(result).toBe("`iv-clock-advance:Danger|Clocks/Danger.md|2|4|2|6`");
  });

  it("generates clock advance syntax with odds", () => {
    const result = clockAdvanceToInlineSyntax(
      "Danger",
      "Clocks/Danger.md",
      2,
      4,
      2,
      6,
      {
        odds: "Likely",
        roll: 45,
        result: "Yes",
      },
    );
    expect(result).toBe(
      "`iv-clock-advance:Danger|Clocks/Danger.md|2|4|2|6|odds=Likely:45:Yes`",
    );
  });

  it("generates clock resolve syntax", () => {
    const result = clockResolveToInlineSyntax("Danger", "Clocks/Danger.md");
    expect(result).toBe("`iv-clock-resolve:Danger|Clocks/Danger.md`");
  });
});

// ============================================================================
// Meter Parsing Tests
// ============================================================================

describe("parseMeterInline", () => {
  it("parses basic meter syntax", () => {
    const result = parseMeterInline("iv-meter:Health|5|3");
    expect(result).toEqual({
      type: "meter",
      name: "Health",
      from: 5,
      to: 3,
    });
  });

  it("parses meter with negative values", () => {
    const result = parseMeterInline("iv-meter:Spirit|-2|-3");
    expect(result).toEqual({
      type: "meter",
      name: "Spirit",
      from: -2,
      to: -3,
    });
  });

  it("returns null for invalid syntax", () => {
    expect(parseMeterInline("not a meter")).toBeNull();
    expect(parseMeterInline("iv-meter:Health")).toBeNull();
    expect(parseMeterInline("iv-meter:Health|a|3")).toBeNull();
  });
});

describe("parseBurnInline", () => {
  it("parses basic burn syntax", () => {
    const result = parseBurnInline("iv-burn:8|2");
    expect(result).toEqual({
      type: "burn",
      from: 8,
      to: 2,
    });
  });

  it("returns null for invalid syntax", () => {
    expect(parseBurnInline("not a burn")).toBeNull();
    expect(parseBurnInline("iv-burn:8")).toBeNull();
  });
});

describe("parseInitiativeInline", () => {
  it("parses initiative with from and to", () => {
    const result = parseInitiativeInline(
      "iv-initiative:Initiative|in control|bad spot",
    );
    expect(result).toEqual({
      type: "initiative",
      label: "Initiative",
      from: "in control",
      to: "bad spot",
    });
  });

  it("parses initiative with only to", () => {
    const result = parseInitiativeInline("iv-initiative:Position||in control");
    expect(result).toEqual({
      type: "initiative",
      label: "Position",
      from: undefined,
      to: "in control",
    });
  });

  it("returns null for invalid syntax", () => {
    expect(parseInitiativeInline("not initiative")).toBeNull();
    expect(parseInitiativeInline("iv-initiative:")).toBeNull();
  });
});

describe("meterToInlineSyntax", () => {
  it("generates meter syntax", () => {
    const result = meterToInlineSyntax("Health", 5, 3);
    expect(result).toBe("`iv-meter:Health|5|3`");
  });
});

describe("burnToInlineSyntax", () => {
  it("generates burn syntax", () => {
    const result = burnToInlineSyntax(8, 2);
    expect(result).toBe("`iv-burn:8|2`");
  });
});

describe("initiativeToInlineSyntax", () => {
  it("generates initiative syntax with from and to", () => {
    const result = initiativeToInlineSyntax(
      "Initiative",
      "in control",
      "bad spot",
    );
    expect(result).toBe("`iv-initiative:Initiative|in control|bad spot`");
  });

  it("generates initiative syntax with only to", () => {
    const result = initiativeToInlineSyntax(
      "Position",
      undefined,
      "in control",
    );
    expect(result).toBe("`iv-initiative:Position||in control`");
  });
});

// ============================================================================
// Extended isInlineMechanics Tests
// ============================================================================

describe("isInlineMechanics extended", () => {
  it("returns true for track-advance syntax", () => {
    expect(isInlineMechanics("iv-track-advance:Name|Path|0|4|rank|2")).toBe(
      true,
    );
  });

  it("returns true for track-create syntax", () => {
    expect(isInlineMechanics("iv-track-create:Name|Path")).toBe(true);
  });

  it("returns true for track-complete syntax", () => {
    expect(isInlineMechanics("iv-track-complete:Name|Path")).toBe(true);
  });

  it("returns true for track-reopen syntax", () => {
    expect(isInlineMechanics("iv-track-reopen:Name|Path")).toBe(true);
  });

  it("returns true for clock-create syntax", () => {
    expect(isInlineMechanics("iv-clock-create:Name|Path")).toBe(true);
  });

  it("returns true for clock-advance syntax", () => {
    expect(isInlineMechanics("iv-clock-advance:Name|Path|0|2|6")).toBe(true);
  });

  it("returns true for clock-resolve syntax", () => {
    expect(isInlineMechanics("iv-clock-resolve:Name|Path")).toBe(true);
  });

  it("returns true for meter syntax", () => {
    expect(isInlineMechanics("iv-meter:Health|5|3")).toBe(true);
  });

  it("returns true for burn syntax", () => {
    expect(isInlineMechanics("iv-burn:8|2")).toBe(true);
  });

  it("returns true for initiative syntax", () => {
    expect(
      isInlineMechanics("iv-initiative:Initiative|in control|bad spot"),
    ).toBe(true);
  });
});

// ============================================================================
// Extended parseInlineMechanics Tests
// ============================================================================

describe("parseInlineMechanics extended", () => {
  it("parses track-advance", () => {
    const result = parseInlineMechanics(
      "iv-track-advance:Name|Path|0|4|rank|2",
    );
    expect(result?.type).toBe("track-advance");
  });

  it("parses track-create", () => {
    const result = parseInlineMechanics("iv-track-create:Name|Path");
    expect(result?.type).toBe("track-create");
  });

  it("parses track-complete", () => {
    const result = parseInlineMechanics("iv-track-complete:Name|Path");
    expect(result?.type).toBe("track-complete");
  });

  it("parses track-reopen", () => {
    const result = parseInlineMechanics("iv-track-reopen:Name|Path");
    expect(result?.type).toBe("track-reopen");
  });

  it("parses clock-create", () => {
    const result = parseInlineMechanics("iv-clock-create:Name|Path");
    expect(result?.type).toBe("clock-create");
  });

  it("parses clock-advance", () => {
    const result = parseInlineMechanics("iv-clock-advance:Name|Path|0|2|6");
    expect(result?.type).toBe("clock-advance");
  });

  it("parses clock-resolve", () => {
    const result = parseInlineMechanics("iv-clock-resolve:Name|Path");
    expect(result?.type).toBe("clock-resolve");
  });

  it("parses meter", () => {
    const result = parseInlineMechanics("iv-meter:Health|5|3");
    expect(result?.type).toBe("meter");
  });

  it("parses burn", () => {
    const result = parseInlineMechanics("iv-burn:8|2");
    expect(result?.type).toBe("burn");
  });

  it("parses initiative", () => {
    const result = parseInlineMechanics(
      "iv-initiative:Initiative|in control|bad spot",
    );
    expect(result?.type).toBe("initiative");
  });

  it("parses entity-create", () => {
    const result = parseInlineMechanics(
      "iv-entity-create:NPC|Kira|Entities/Kira.md",
    );
    expect(result?.type).toBe("entity-create");
  });
});

// ============================================================================
// Entity Parsing Tests
// ============================================================================

describe("parseEntityCreateInline", () => {
  it("parses basic entity create syntax", () => {
    const result = parseEntityCreateInline(
      "iv-entity-create:NPC|Kira|Entities/Kira.md",
    );
    expect(result).toEqual({
      type: "entity-create",
      entityType: "NPC",
      name: "Kira",
      path: "Entities/Kira.md",
    });
  });

  it("parses entity with spaces in name", () => {
    const result = parseEntityCreateInline(
      "iv-entity-create:Location|The Frozen Wastes|Locations/The Frozen Wastes.md",
    );
    expect(result).toEqual({
      type: "entity-create",
      entityType: "Location",
      name: "The Frozen Wastes",
      path: "Locations/The Frozen Wastes.md",
    });
  });

  it("returns null for invalid syntax", () => {
    expect(parseEntityCreateInline("not an entity")).toBeNull();
    expect(parseEntityCreateInline("iv-entity-create:NPC")).toBeNull();
    expect(parseEntityCreateInline("iv-entity-create:NPC|Name")).toBeNull();
  });
});

describe("entityCreateToInlineSyntax", () => {
  it("generates entity create syntax", () => {
    const result = entityCreateToInlineSyntax(
      "NPC",
      "Kira",
      "Entities/Kira.md",
    );
    expect(result).toBe("`iv-entity-create:NPC|Kira|Entities/Kira.md`");
  });

  it("generates entity create syntax with spaces", () => {
    const result = entityCreateToInlineSyntax(
      "Location",
      "The Frozen Wastes",
      "Locations/The Frozen Wastes.md",
    );
    expect(result).toBe(
      "`iv-entity-create:Location|The Frozen Wastes|Locations/The Frozen Wastes.md`",
    );
  });
});

describe("isInlineMechanics extended - entity-create", () => {
  it("returns true for entity-create syntax", () => {
    expect(
      isInlineMechanics("iv-entity-create:NPC|Kira|Entities/Kira.md"),
    ).toBe(true);
  });
});

// ============================================================================
// Dice Roll Parsing Tests
// ============================================================================

import {
  parseDiceRollInline,
  diceRollToInlineSyntax,
  parseActionRollInline,
  actionRollToInlineSyntax,
} from "./syntax";

describe("parseDiceRollInline", () => {
  it("parses basic dice roll syntax", () => {
    const result = parseDiceRollInline("iv-dice:2d6+3|15");
    expect(result).toEqual({
      type: "dice-roll",
      expression: "2d6+3",
      result: 15,
    });
  });

  it("parses dice roll with complex expression", () => {
    const result = parseDiceRollInline("iv-dice:2d6{4+3=7}+20|27");
    expect(result).toEqual({
      type: "dice-roll",
      expression: "2d6{4+3=7}+20",
      result: 27,
    });
  });

  it("returns null for invalid syntax", () => {
    expect(parseDiceRollInline("not a dice roll")).toBeNull();
    expect(parseDiceRollInline("iv-dice:2d6")).toBeNull();
    expect(parseDiceRollInline("iv-dice:2d6|abc")).toBeNull();
  });
});

describe("diceRollToInlineSyntax", () => {
  it("generates dice roll syntax", () => {
    const result = diceRollToInlineSyntax("2d6+3", 15);
    expect(result).toBe("`iv-dice:2d6+3|15`");
  });

  it("generates dice roll syntax with complex expression", () => {
    const result = diceRollToInlineSyntax("2d6{4+3=7}+20", 27);
    expect(result).toBe("`iv-dice:2d6{4+3=7}+20|27`");
  });
});

// ============================================================================
// Action Roll Parsing Tests
// ============================================================================

describe("parseActionRollInline", () => {
  it("parses basic action roll syntax", () => {
    const result = parseActionRollInline("iv-action-roll:Momentum|3|9|0|5|4");
    expect(result).toEqual({
      type: "action-roll",
      stat: "Momentum",
      action: 3,
      statVal: 9,
      adds: 0,
      addsDetail: undefined,
      vs1: 5,
      vs2: 4,
      burn: undefined,
    });
  });

  it("parses action roll with burn", () => {
    const result = parseActionRollInline(
      "iv-action-roll:Edge|4|2|1|5|9|burn=8:2",
    );
    expect(result?.burn).toEqual({ orig: 8, reset: 2 });
  });

  it("parses action roll with adds detail", () => {
    const result = parseActionRollInline(
      "iv-action-roll:Iron|4|2|3|3|7|adds=2(Asset),1(Companion)",
    );
    expect(result?.addsDetail).toEqual([
      { amount: 2, desc: "Asset" },
      { amount: 1, desc: "Companion" },
    ]);
  });

  it("parses action roll with burn and adds", () => {
    const result = parseActionRollInline(
      "iv-action-roll:Shadow|4|2|3|3|7|burn=8:2|adds=2(Asset)",
    );
    expect(result?.burn).toEqual({ orig: 8, reset: 2 });
    expect(result?.addsDetail).toEqual([{ amount: 2, desc: "Asset" }]);
  });

  it("returns null for invalid syntax", () => {
    expect(parseActionRollInline("not an action roll")).toBeNull();
    expect(parseActionRollInline("iv-action-roll:Momentum|3")).toBeNull();
    expect(
      parseActionRollInline("iv-action-roll:Momentum|a|9|0|5|4"),
    ).toBeNull();
  });
});

describe("actionRollToInlineSyntax", () => {
  it("generates basic action roll syntax", () => {
    const result = actionRollToInlineSyntax("Momentum", 3, 9, 0, 5, 4);
    expect(result).toBe("`iv-action-roll:Momentum|3|9|0|5|4`");
  });

  it("generates action roll syntax with burn", () => {
    const result = actionRollToInlineSyntax("Edge", 4, 2, 1, 5, 9, undefined, {
      orig: 8,
      reset: 2,
    });
    expect(result).toBe("`iv-action-roll:Edge|4|2|1|5|9|burn=8:2`");
  });

  it("generates action roll syntax with adds detail", () => {
    const result = actionRollToInlineSyntax("Iron", 4, 2, 3, 3, 7, [
      { amount: 2, desc: "Asset" },
      { amount: 1, desc: "Companion" },
    ]);
    expect(result).toBe(
      "`iv-action-roll:Iron|4|2|3|3|7|adds=2(Asset),1(Companion)`",
    );
  });

  it("generates action roll syntax with burn and adds", () => {
    const result = actionRollToInlineSyntax(
      "Shadow",
      4,
      2,
      2,
      3,
      7,
      [{ amount: 2, desc: "Asset" }],
      { orig: 8, reset: 2 },
    );
    expect(result).toBe(
      "`iv-action-roll:Shadow|4|2|2|3|7|burn=8:2|adds=2(Asset)`",
    );
  });
});

describe("isInlineMechanics extended - dice and action rolls", () => {
  it("returns true for dice-roll syntax", () => {
    expect(isInlineMechanics("iv-dice:2d6+3|15")).toBe(true);
  });

  it("returns true for action-roll syntax", () => {
    expect(isInlineMechanics("iv-action-roll:Momentum|3|9|0|5|4")).toBe(true);
  });
});

describe("parseInlineMechanics extended - dice and action rolls", () => {
  it("parses dice-roll", () => {
    const result = parseInlineMechanics("iv-dice:2d6+3|15");
    expect(result?.type).toBe("dice-roll");
  });

  it("parses action-roll", () => {
    const result = parseInlineMechanics("iv-action-roll:Momentum|3|9|0|5|4");
    expect(result?.type).toBe("action-roll");
  });
});

// ============================================================================
// Reroll Tests
// ============================================================================

import { parseRerollInline, rerollToInlineSyntax } from "./syntax";

describe("parseRerollInline", () => {
  it("parses basic reroll syntax for action die", () => {
    const result = parseRerollInline("iv-reroll:action|3|6|Edge|2|1|5|9|3");
    expect(result).toEqual({
      type: "reroll",
      die: "action",
      oldVal: 3,
      newVal: 6,
      stat: "Edge",
      statVal: 2,
      adds: 1,
      vs1: 5,
      vs2: 9,
      action: 3,
    });
  });

  it("parses reroll syntax for vs1", () => {
    const result = parseRerollInline("iv-reroll:vs1|8|3|Iron|3|0|3|7|4");
    expect(result).toEqual({
      type: "reroll",
      die: "vs1",
      oldVal: 8,
      newVal: 3,
      stat: "Iron",
      statVal: 3,
      adds: 0,
      vs1: 3,
      vs2: 7,
      action: 4,
    });
  });

  it("parses reroll syntax for vs2", () => {
    const result = parseRerollInline("iv-reroll:vs2|10|2|Shadow|1|2|5|2|3");
    expect(result).toEqual({
      type: "reroll",
      die: "vs2",
      oldVal: 10,
      newVal: 2,
      stat: "Shadow",
      statVal: 1,
      adds: 2,
      vs1: 5,
      vs2: 2,
      action: 3,
    });
  });

  it("returns null for invalid die name", () => {
    expect(
      parseRerollInline("iv-reroll:invalid|3|6|Edge|2|1|5|9|3"),
    ).toBeNull();
  });

  it("returns null for missing parts", () => {
    expect(parseRerollInline("iv-reroll:action|3|6")).toBeNull();
  });

  it("returns null for non-numeric values", () => {
    expect(parseRerollInline("iv-reroll:action|a|6|Edge|2|1|5|9|3")).toBeNull();
  });

  it("returns null for non-reroll prefix", () => {
    expect(parseRerollInline("iv-move:Strike|Iron|4|2|1|3|7")).toBeNull();
  });
});

describe("rerollToInlineSyntax", () => {
  it("generates reroll syntax for action die", () => {
    const result = rerollToInlineSyntax("action", 3, 6, "Edge", 2, 1, 5, 9, 3);
    expect(result).toBe("`iv-reroll:action|3|6|Edge|2|1|5|9|3`");
  });

  it("generates reroll syntax for vs1", () => {
    const result = rerollToInlineSyntax("vs1", 8, 3, "Iron", 3, 0, 3, 7, 4);
    expect(result).toBe("`iv-reroll:vs1|8|3|Iron|3|0|3|7|4`");
  });

  it("generates reroll syntax for vs2", () => {
    const result = rerollToInlineSyntax("vs2", 10, 2, "Shadow", 1, 2, 5, 2, 3);
    expect(result).toBe("`iv-reroll:vs2|10|2|Shadow|1|2|5|2|3`");
  });
});

describe("isInlineMechanics extended - reroll", () => {
  it("returns true for reroll syntax", () => {
    expect(isInlineMechanics("iv-reroll:action|3|6|Edge|2|1|5|9|3")).toBe(true);
  });
});

describe("parseInlineMechanics extended - reroll", () => {
  it("parses reroll", () => {
    const result = parseInlineMechanics("iv-reroll:action|3|6|Edge|2|1|5|9|3");
    expect(result?.type).toBe("reroll");
  });
});


// ============================================================================
// OOC (Out-of-Character) Comment Tests
// ============================================================================

import { parseOOCInline, oocToInlineSyntax } from "./syntax";

describe("parseOOCInline", () => {
  it("parses basic OOC syntax", () => {
    const result = parseOOCInline("iv-ooc:This is a comment");
    expect(result).toEqual({
      type: "ooc",
      text: "This is a comment",
    });
  });

  it("parses OOC with special characters", () => {
    const result = parseOOCInline("iv-ooc:Note: I'm not sure about this!");
    expect(result).toEqual({
      type: "ooc",
      text: "Note: I'm not sure about this!",
    });
  });

  it("parses OOC with pipe characters", () => {
    const result = parseOOCInline("iv-ooc:Option A | Option B");
    expect(result).toEqual({
      type: "ooc",
      text: "Option A | Option B",
    });
  });

  it("returns null for empty OOC", () => {
    expect(parseOOCInline("iv-ooc:")).toBeNull();
  });

  it("returns null for non-OOC prefix", () => {
    expect(parseOOCInline("iv-move:Strike|Iron|4|2|1|3|7")).toBeNull();
  });

  it("returns null for invalid syntax", () => {
    expect(parseOOCInline("not an ooc")).toBeNull();
  });
});

describe("oocToInlineSyntax", () => {
  it("generates OOC syntax", () => {
    const result = oocToInlineSyntax("This is a comment");
    expect(result).toBe("`iv-ooc:This is a comment`");
  });

  it("generates OOC syntax with special characters", () => {
    const result = oocToInlineSyntax("Note: I'm not sure about this!");
    expect(result).toBe("`iv-ooc:Note: I'm not sure about this!`");
  });
});

describe("isInlineMechanics extended - OOC", () => {
  it("returns true for OOC syntax", () => {
    expect(isInlineMechanics("iv-ooc:This is a comment")).toBe(true);
  });
});

describe("parseInlineMechanics extended - OOC", () => {
  it("parses OOC", () => {
    const result = parseInlineMechanics("iv-ooc:This is a comment");
    expect(result?.type).toBe("ooc");
  });
});
