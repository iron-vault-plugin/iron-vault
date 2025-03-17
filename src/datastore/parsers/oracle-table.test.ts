import { type Datasworn } from "@datasworn/core";
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
    const expectedOracle: Partial<Datasworn.OracleTableText> = {
      _id: "oracle_rollable:custom/foo",
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
          _id: "oracle_rollable.row:custom/foo.0",
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
          _id: "oracle_rollable.row:custom/foo.1",
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
          _id: "oracle_rollable.row:custom/foo.2",
          roll: { min: 6, max: 6 },
          text: "Just foo\n\nNew line",
        },
      ],
    };
    expect(extractOracleTable("custom/foo", table)).toEqual(expectedOracle);
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
