import { DataswornSource, type Datasworn } from "@datasworn/core";
import { extractOracleTable, parseResultTemplate } from "./oracle-table";

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
