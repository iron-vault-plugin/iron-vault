import { DataswornSource, type Datasworn } from "@datasworn/core";
import { Dice } from "utils/dice";
import {
  extractOracleTable,
  flattenDiceCombination,
  flattenRangeExpr,
  parseRange,
  parseRanges,
  parseResultTemplate,
} from "./oracle-table";

describe("parseRange", () => {
  it.each`
    range      | min  | max
    ${"1"}     | ${1} | ${1}
    ${"1-2"}   | ${1} | ${2}
    ${"1 - 2"} | ${1} | ${2}
  `("parses range $range to min $min and max $max", ({ range, min, max }) => {
    const result = parseRange(range);
    expect(result).toEqual({
      min,
      max,
    });
  });

  it("returns undefined for invalid range", () => {
    const result = parseRange("invalid");
    expect(result).toBeUndefined();
  });
  it("returns undefined for empty string", () => {
    const result = parseRange("");
    expect(result).toBeUndefined();
  });
  it("returns undefined for non-numeric range", () => {
    const result = parseRange("1-foo");
    expect(result).toBeUndefined();
  });
});

describe("parseRanges", () => {
  it.each`
    range          | results
    ${"1"}         | ${[{ min: 1, max: 1 }]}
    ${"1-2"}       | ${[{ min: 1, max: 2 }]}
    ${"1;3 - 6"}   | ${[{ min: 1, max: 1 }, { min: 3, max: 6 }]}
    ${"1-2;3 - 6"} | ${[{ min: 1, max: 2 }, { min: 3, max: 6 }]}
  `("parses range $range to $results", ({ range, results }) => {
    const result = parseRanges(range);
    expect(result).toEqual(results);
  });
});

describe("extractOracleTable", () => {
  it("converts a markdown roll table into an oracle", () => {
    const table = `
    | dice: 1d6 | Something special |
    | --------- | ------ |
    | 1-2       | [Action](oracle_rollable:starforged/core/action) |
    | 3-5       | [Theme](oracle_rollable:starforged/core/theme) |
    | 6       | Just foo<br>New line |
    `;
    const expectedOracle: Partial<DataswornSource.OracleTableText> = {
      //name: "Foo",
      dice: "1d6",
      // source: {
      //   authors: [{ name: "Test" }],
      //   date: "2023-12-22",
      //   license: "Foo",
      //   title: "Tests",
      //   url: "https://example.com",
      // },
      column_labels: { roll: "Roll", text: "Something special" },
      type: "oracle_rollable",
      oracle_type: "table_text",
      rows: [
        {
          roll: {
            min: 1,
            max: 2,
          },
          text: "[Action](oracle_rollable:starforged/core/action)",
          template: {
            text: "{{text>oracle_rollable:starforged/core/action}}",
          },
        },
        {
          roll: {
            min: 3,
            max: 5,
          },
          text: "[Theme](oracle_rollable:starforged/core/theme)",
          template: {
            text: "{{text>oracle_rollable:starforged/core/theme}}",
          },
        },
        {
          roll: { min: 6, max: 6 },
          text: "Just foo\n\nNew line",
        },
      ],
    };
    expect(extractOracleTable(table)).toEqual(expectedOracle);
  });

  it("supports dice lists", () => {
    const table = `
    | dice: 1d6;1d6 | Something special |
    | --------- | ------ |
    | 1-2;1-2       | Line 1 |
    | 1-2;3-6       | Line 2 |
    | 3;1-6       | Line 3 |
    | 4-6;1       | Line 4 |
    | 4-6;2-6 | Line 5 |
    `;
    const result = extractOracleTable(table);
    expect(result.dice).toEqual("1d36");
    expect(
      result.rows.map(({ roll, text }) => ({ ...roll, text })),
    ).toMatchObject([
      { min: 1, max: 2, text: "Line 1" },
      { min: 3, max: 6, text: "Line 2" },
      { min: 7, max: 8, text: "Line 1" },
      { min: 9, max: 12, text: "Line 2" },
      { min: 13, max: 18, text: "Line 3" },
      { min: 19, max: 19, text: "Line 4" },
      { min: 20, max: 24, text: "Line 5" },
      { min: 25, max: 25, text: "Line 4" },
      { min: 26, max: 30, text: "Line 5" },
      { min: 31, max: 31, text: "Line 4" },
      { min: 32, max: 36, text: "Line 5" },
    ]);
  });
});

describe("parseResultTemplate", () => {
  it("parses a result template", () => {
    expect(
      parseResultTemplate("[Action](oracle_rollable:starforged/core/action)"),
    ).toEqual<Datasworn.OracleRollTemplate>({
      text: "{{text>oracle_rollable:starforged/core/action}}",
    });
  });

  it("parses a result template with multiple results", () => {
    expect(
      parseResultTemplate(
        "[Action](oracle_rollable:starforged/core/action) [Theme](oracle_rollable:starforged/core/theme)",
      ),
    ).toEqual<Datasworn.OracleRollTemplate>({
      text: "{{text>oracle_rollable:starforged/core/action}} {{text>oracle_rollable:starforged/core/theme}}",
    });
  });

  it("returns undefined if no template strings found", () => {
    expect(parseResultTemplate("asd")).toBeUndefined();
  });
});
describe("flattenDiceCombination", () => {
  it("returns the same dice if only one exists", () => {
    const dice = new Dice(2, 6); // 2d6
    expect(flattenDiceCombination([dice])).toEqual(dice);
  });

  it("flattens a combination of two dice", () => {
    const dice1 = new Dice(1, 6); // 1d6
    const dice2 = new Dice(1, 6); // 1d6
    const result = flattenDiceCombination([dice1, dice2]);
    expect(result).toEqual(new Dice(1, 36)); // 1d36
  });

  it("flattens a combination of three dice", () => {
    const dice1 = new Dice(1, 4); // 1d4
    const dice2 = new Dice(1, 6); // 1d6
    const dice3 = new Dice(1, 8); // 1d8
    const result = flattenDiceCombination([dice1, dice2, dice3]);
    expect(result).toEqual(new Dice(1, 192)); // 1d192 (4*6*8)
  });

  it("throws an error when trying to flatten dice with multiple count", () => {
    const dice1 = new Dice(2, 6); // 2d6
    const dice2 = new Dice(1, 8); // 1d8
    expect(() => flattenDiceCombination([dice1, dice2])).toThrow(
      "cannot flatten dice with multiple counts",
    );
  });
});
describe("flattenRangeExpr", () => {
  it("flattens a single dice range", () => {
    const dice = [new Dice(1, 6)];
    const result = flattenRangeExpr(dice, "1-3");
    expect(result).toEqual([{ min: 1, max: 3 }]);
  });

  it("flattens two dice ranges", () => {
    const dice = [new Dice(1, 6), new Dice(1, 6)];
    const result = flattenRangeExpr(dice, "1-2;3-4");
    expect(result).toEqual([
      { min: 3, max: 4 }, // 0*6 + 3 = 3, 0*6 + 4 = 4
      { min: 9, max: 10 }, // 1*6 + 3 = 9, 1*6 + 4 = 10
    ]);
  });

  it("has right min and max", () => {
    const dice = [new Dice(1, 6), new Dice(1, 8)];
    expect(flattenRangeExpr(dice, "1;1-8")).toEqual([{ min: 1, max: 8 }]);
    expect(flattenRangeExpr(dice, "6;1-8")).toEqual([{ min: 41, max: 48 }]);
  });

  it("flattens three dice ranges", () => {
    const dice = [new Dice(1, 4), new Dice(1, 6), new Dice(1, 8)];
    const result = flattenRangeExpr(dice, "2;1-2;3-4");
    expect(result).toEqual([
      { min: 51, max: 52 }, // 1*48 + 0*8 + 3 = 51, 1*48 + 0*8 + 4 = 52
      { min: 59, max: 60 }, // 1*48 + 1*8 + 3 = 59, 1*48 + 1*8 + 4 = 60
    ]);
  });

  it("throws an error with mismatched ranges and dice count", () => {
    const dice = [new Dice(1, 6), new Dice(1, 6)];
    expect(() => flattenRangeExpr(dice, "1-3")).toThrow(
      "expected 2 ranges, found 1",
    );
  });

  it("throws an error with invalid range expression", () => {
    const dice = [new Dice(1, 6)];
    expect(() => flattenRangeExpr(dice, "invalid")).toThrow(
      "invalid range expression invalid",
    );
  });

  it("handles single value ranges correctly", () => {
    const dice = [new Dice(1, 6), new Dice(1, 6)];
    const result = flattenRangeExpr(dice, "1;2");
    expect(result).toEqual([{ min: 2, max: 2 }]); // 0*6 + 2 = 2
  });
});
