import { OracleTableSimple } from "@datasworn/core";
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
    const expectedOracle: Partial<OracleTableSimple> = {
      id: "custom/oracles/foo",
      //name: "Foo",
      dice: "1d6",
      // source: {
      //   authors: [{ name: "Test" }],
      //   date: "2023-12-22",
      //   license: "Foo",
      //   title: "Tests",
      //   url: "https://example.com",
      // },
      column_labels: { roll: "Roll", result: "Something special" },
      oracle_type: "table_simple",
      rows: [
        {
          id: "custom/oracles/foo/1-2",
          min: 1,
          max: 2,
          result: "[Action](id:starforged/oracles/core/action)",
          template: { result: "{{result:starforged/oracles/core/action}}" },
        },
        {
          id: "custom/oracles/foo/3-5",
          min: 3,
          max: 5,
          result: "[Theme](id:starforged/oracles/core/theme)",
          template: {
            result: "{{result:starforged/oracles/core/theme}}",
          },
        },
        {
          id: "custom/oracles/foo/6-6",
          min: 6,
          max: 6,
          result: "Just foo",
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
    ).toEqual({
      result: "{{result:starforged/oracles/core/action}}",
    });
  });

  it("parses a result template with multiple results", () => {
    expect(
      parseResultTemplate(
        "[Action](id:starforged/oracles/core/action) [Theme](id:starforged/oracles/core/theme)",
      ),
    ).toEqual({
      result:
        "{{result:starforged/oracles/core/action}} {{result:starforged/oracles/core/theme}}",
    });
  });

  it("returns undefined if no template strings found", () => {
    expect(parseResultTemplate("asd")).toBeUndefined();
  });
});
