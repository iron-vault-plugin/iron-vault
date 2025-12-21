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
} from "./syntax";

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
      "iv-move:Strike|Iron|4|2|1|3|7|move:starforged/combat/strike"
    );
    expect(result?.moveId).toBe("move:starforged/combat/strike");
  });

  it("parses move with burn", () => {
    const result = parseMoveInline(
      "iv-move:Face Danger|Shadow|3|2|0|5|9|move:starforged/adventure/face_danger|burn=8:2"
    );
    expect(result?.burn).toEqual({ orig: 8, reset: 2 });
  });

  it("parses move with adds detail", () => {
    const result = parseMoveInline(
      "iv-move:Strike|Iron|4|2|3|3|7|move:starforged/combat/strike|adds=2(Asset),1(Companion)"
    );
    expect(result?.addsDetail).toEqual([
      { amount: 2, desc: "Asset" },
      { amount: 1, desc: "Companion" },
    ]);
  });

  it("parses move with adds detail without descriptions", () => {
    const result = parseMoveInline(
      "iv-move:Strike|Iron|4|2|3|3|7|move:starforged/combat/strike|adds=2,1"
    );
    expect(result?.addsDetail).toEqual([
      { amount: 2, desc: undefined },
      { amount: 1, desc: undefined },
    ]);
  });

  it("parses move with burn and adds", () => {
    const result = parseMoveInline(
      "iv-move:Strike|Iron|4|2|3|3|7|move:starforged/combat/strike|burn=8:2|adds=2(Asset),1"
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
      "iv-oracle:Action|45|Bolster|oracle:starforged/oracles/core/action"
    );
    expect(result?.oracleId).toBe("oracle:starforged/oracles/core/action");
  });

  it("parses oracle with cursed die", () => {
    const result = parseOracleInline(
      "iv-oracle:Action|45|Bolster|oracle:starforged/oracles/core/action|cursed=7"
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
  it("parses basic progress syntax", () => {
    const result = parseProgressInline("iv-progress:Escape the Vault|7|3|9");
    expect(result).toEqual({
      type: "progress",
      trackName: "Escape the Vault",
      score: 7,
      vs1: 3,
      vs2: 9,
    });
  });

  it("returns null for invalid syntax", () => {
    expect(parseProgressInline("not a progress")).toBeNull();
    expect(parseProgressInline("iv-progress:Track|7")).toBeNull();
    expect(parseProgressInline("iv-progress:Track|a|3|9")).toBeNull();
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
      "iv-noroll:Begin a Session|move:starforged/session/begin_a_session"
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
    const result = parseInlineMechanics("iv-progress:Track|7|3|9");
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
      ])
    ).toBe("2(Asset) + 1(Companion)");
  });

  it("formats adds without descriptions", () => {
    expect(
      formatAddsForDisplay([{ amount: 2 }, { amount: 1 }])
    ).toBe("2 + 1");
  });

  it("formats mixed adds", () => {
    expect(
      formatAddsForDisplay([
        { amount: 2, desc: "Asset" },
        { amount: 1 },
      ])
    ).toBe("2(Asset) + 1");
  });
});

describe("progressToInlineSyntax", () => {
  it("extracts display name from wiki-link with alias", () => {
    const move = {
      name: "Fulfill Your Vow",
      progressTrack: "[[Campaign/Progress/My Vow.md|My Vow]]",
      progressTicks: 28,
      challenge1: 3,
      challenge2: 9,
    };
    const result = progressToInlineSyntax(move);
    expect(result).toBe("`iv-progress:My Vow|7|3|9`");
  });

  it("extracts filename from wiki-link without alias", () => {
    const move = {
      name: "Fulfill Your Vow",
      progressTrack: "[[Campaign/Progress/My Vow.md]]",
      progressTicks: 28,
      challenge1: 3,
      challenge2: 9,
    };
    const result = progressToInlineSyntax(move);
    expect(result).toBe("`iv-progress:My Vow|7|3|9`");
  });

  it("handles plain text track names", () => {
    const move = {
      name: "Fulfill Your Vow",
      progressTrack: "My Vow",
      progressTicks: 28,
      challenge1: 3,
      challenge2: 9,
    };
    const result = progressToInlineSyntax(move);
    expect(result).toBe("`iv-progress:My Vow|7|3|9`");
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
    expect(result).toBe("`iv-noroll:Begin a Session|move:starforged/session/begin_a_session`");
  });
});
