import { type Datasworn } from "@datasworn/core";
import { extractOracleTable, parseResultTemplate } from "./oracle-table";

describe("extractOracleTable", () => {
  it("converts a markdown roll table into an oracle", () => {
    const table = `
    | dice: 1d6 | Something special |
    | --------- | ------ |
    | 1-2       | [Action](id:starforged/oracles/core/action) |
    | 3-5       | [Theme](id:starforged/oracles/core/theme) |
    | 6       | Just foo |
    `;
    const expectedOracle: Partial<Datasworn.OracleTableText> = {
      _id: "custom/oracles/foo",
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
          min: 1,
          max: 2,
          text: "[Action](id:starforged/oracles/core/action)",
          template: { text: "{{text:starforged/oracles/core/action}}" },
        },
        {
          min: 3,
          max: 5,
          text: "[Theme](id:starforged/oracles/core/theme)",
          template: {
            text: "{{text:starforged/oracles/core/theme}}",
          },
        },
        {
          min: 6,
          max: 6,
          text: "Just foo",
        },
      ],
    };
    expect(extractOracleTable("custom/oracles/foo", table)).toEqual(
      expectedOracle,
    );
  });
});

describe("parseResultTemplate", () => {
  it("parses a result template", () => {
    expect(
      parseResultTemplate("[Action](id:starforged/oracles/core/action)"),
    ).toEqual<Datasworn.OracleRollTemplate>({
      text: "{{text:starforged/oracles/core/action}}",
    });
  });

  it("parses a result template with multiple results", () => {
    expect(
      parseResultTemplate(
        "[Action](id:starforged/oracles/core/action) [Theme](id:starforged/oracles/core/theme)",
      ),
    ).toEqual<Datasworn.OracleRollTemplate>({
      text: "{{text:starforged/oracles/core/action}} {{text:starforged/oracles/core/theme}}",
    });
  });

  it("returns undefined if no template strings found", () => {
    expect(parseResultTemplate("asd")).toBeUndefined();
  });
});
