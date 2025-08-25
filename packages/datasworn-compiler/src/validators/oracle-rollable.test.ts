import { DataswornSource } from "@datasworn/core";
import { Result, Unit } from "true-myth";
import { unwrapErr } from "true-myth/test-support";
import { describe, expect, it } from "vitest";
import { validateOracleRollable } from "./oracle-rollable";

// Test data factory
function createOracleRollable(
  overrides: Partial<DataswornSource.OracleTableText> = {},
): DataswornSource.OracleRollable {
  return {
    type: "oracle_rollable",
    oracle_type: "table_text",
    name: "Test Oracle Rollable",
    _source: {
      authors: [],
      date: "2024-01-01",
      title: "Test",
      license: "MIT",
      url: "http://example.com",
    },
    dice: "1d100",
    rows: [],
    ...overrides,
  };
}

function createRow(
  min: number,
  max: number,
  text: string = "Test result",
): DataswornSource.OracleRollableRow {
  return {
    roll: { min, max },
    text,
  };
}

describe("validateOracleRollable", () => {
  describe("valid oracle rollables", () => {
    it("validates single row", () => {
      const data = createOracleRollable({
        rows: [createRow(1, 100)],
      });
      const result = validateOracleRollable(data);
      expect(result).toEqual(Result.ok(Unit));
    });

    it("validates multiple contiguous rows", () => {
      const data = createOracleRollable({
        rows: [createRow(1, 50), createRow(51, 75), createRow(76, 100)],
      });
      const result = validateOracleRollable(data);
      expect(result).toEqual(Result.ok(Unit));
    });

    it("validates with custom dice", () => {
      const data = createOracleRollable({
        dice: "1d6",
        rows: [createRow(1, 3), createRow(4, 6)],
      });
      const result = validateOracleRollable(data);
      expect(result).toEqual(Result.ok(Unit));
    });

    it("validates rows without roll ranges", () => {
      const data = createOracleRollable({
        rows: [{ text: "No roll range" }, createRow(1, 100)],
      });
      const result = validateOracleRollable(data);
      expect(result).toEqual(Result.ok(Unit));
    });
  });

  describe("dice validation", () => {
    it("rejects invalid dice string", () => {
      const data = createOracleRollable({
        dice: "invalid-dice",
      });
      const result = validateOracleRollable(data);
      expect(result.isErr).toBe(true);
      if (result.isErr) {
        expect(result.error).toHaveLength(1);
        expect(result.error[0].path).toEqual(["dice"]);
      }
    });

    it("uses default dice when undefined", () => {
      const data = createOracleRollable({
        dice: undefined,
        rows: [createRow(1, 100)],
      });
      const result = validateOracleRollable(data);
      expect(result).toEqual(Result.ok(Unit));
    });
  });

  describe("roll range validation", () => {
    it("rejects missing min value", () => {
      const data = createOracleRollable({
        rows: [
          {
            roll: {
              min: undefined,
              max: 100,
            } as unknown as DataswornSource.DiceRange,
            text: "Test",
          },
        ],
      });
      const result = validateOracleRollable(data);
      expect(unwrapErr(result)).toContainEqual(
        expect.objectContaining({
          path: ["rows", "0", "roll"],
          message: "Both min and max must be defined.",
        }),
      );
    });

    it("rejects missing max value", () => {
      const data = createOracleRollable({
        rows: [
          {
            roll: {
              min: 1,
              max: undefined,
            } as unknown as DataswornSource.DiceRange,
            text: "Test",
          },
        ],
      });
      const result = validateOracleRollable(data);
      expect(unwrapErr(result)).toContainEqual(
        expect.objectContaining({
          path: ["rows", "0", "roll"],
          message: "Both min and max must be defined.",
        }),
      );
    });

    it("rejects min greater than max", () => {
      const data = createOracleRollable({
        rows: [createRow(75, 50)],
      });
      const result = validateOracleRollable(data);
      expect(unwrapErr(result)).toContainEqual(
        expect.objectContaining({
          path: ["rows", "0", "roll"],
          message: "Min (75) must be less than max (50).",
        }),
      );
    });

    it("rejects roll range below dice minimum", () => {
      const data = createOracleRollable({
        dice: "1d100",
        rows: [createRow(0, 50)],
      });
      const result = validateOracleRollable(data);
      expect(unwrapErr(result)).toContainEqual(
        expect.objectContaining({
          path: ["rows", "0", "roll"],
          message: "Roll range must be between 1 and 100.",
        }),
      );
    });

    it("rejects roll range above dice maximum", () => {
      const data = createOracleRollable({
        dice: "1d6",
        rows: [createRow(1, 10)],
      });
      const result = validateOracleRollable(data);
      expect(result.isErr).toBe(true);
      if (result.isErr) {
        expect(result.error).toHaveLength(1);
        expect(result.error[0].message).toBe(
          "Roll range must be between 1 and 6.",
        );
      }
    });
  });

  describe("overlap and contiguity validation", () => {
    it("rejects missing start of range", () => {
      const data = createOracleRollable({
        rows: [createRow(2, 50), createRow(51, 100)],
      });
      const result = validateOracleRollable(data);
      expect(unwrapErr(result)).toContainEqual(
        expect.objectContaining({
          path: ["rows", "0", "roll"],
          message: "First row must start at 1, but starts at 2.",
        }),
      );
    });
    it("rejects missing end of range", () => {
      const data = createOracleRollable({
        rows: [createRow(1, 50), createRow(51, 60)],
      });
      const result = validateOracleRollable(data);
      expect(unwrapErr(result)).toContainEqual(
        expect.objectContaining({
          path: ["rows", "1", "roll"],
          message: "Final row must end at 100, but ends at 60.",
        }),
      );
    });
    it("rejects overlapping ranges", () => {
      const data = createOracleRollable({
        rows: [createRow(1, 50), createRow(45, 100)],
      });
      const result = validateOracleRollable(data);
      expect(result.isErr).toBe(true);
      if (result.isErr) {
        expect(result.error).toHaveLength(1);
        expect(result.error[0].message).toBe(
          "Roll range (45-100) must not overlap with previous row's range (1-50).",
        );
        expect(result.error[0].path).toEqual(["rows", "1", "roll"]);
      }
    });

    it("rejects non-contiguous ranges with gap", () => {
      const data = createOracleRollable({
        rows: [createRow(1, 50), createRow(55, 100)],
      });
      const result = validateOracleRollable(data);
      expect(result.isErr).toBe(true);
      if (result.isErr) {
        expect(result.error).toHaveLength(1);
        expect(result.error[0].message).toBe(
          "Roll range (55-100) must be contiguous with previous row's range (1-50).",
        );
      }
    });

    it("handles multiple validation errors", () => {
      const data = createOracleRollable({
        rows: [
          createRow(75, 50), // min > max
          createRow(1, 25), // overlap with previous
          createRow(30, 200), // gap + exceeds dice max
        ],
      });
      const result = validateOracleRollable(data);
      expect(result.isErr).toBe(true);
      if (result.isErr) {
        expect(result.error.length).toBeGreaterThan(1);
        const messages = result.error.map((e) => e.message);
        expect(messages).toContain("Min (75) must be less than max (50).");
      }
    });
  });

  describe("edge cases", () => {
    it("validates single value ranges", () => {
      const data = createOracleRollable({
        dice: "1d6",
        rows: [createRow(1, 1), createRow(2, 2), createRow(3, 6)],
      });
      const result = validateOracleRollable(data);
      expect(result).toEqual(Result.ok(Unit));
    });

    it("skips validation for rows with null roll ranges", () => {
      const data = createOracleRollable({
        rows: [
          { text: "No roll range" },
          createRow(1, 50),
          { text: "Another no roll" },
          createRow(51, 100),
        ],
      });
      const result = validateOracleRollable(data);
      expect(result).toEqual(Result.ok(Unit));
    });

    it("validates complex dice expressions", () => {
      const data = createOracleRollable({
        dice: "2d10",
        rows: [createRow(2, 10), createRow(11, 20)],
      });
      const result = validateOracleRollable(data);
      expect(result).toEqual(Result.ok(Unit));
    });
  });
});
