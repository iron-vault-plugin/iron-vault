import { OracleTableSimple } from "@datasworn/core";
import { parseTable, tableRows } from "./table";

describe("tableRows", () => {
  it("matches a table row", () => {
    const row = "| foo | bar |\n| -- | -- |\n| asd | sdf |\n";
    expect(tableRows(row)).toEqual([
      [
        ["foo", "bar"],
        ["--", "--"],
        ["asd", "sdf"],
      ],
    ]);
  });
});

describe("parseTable", () => {
  xit("converts a markdown roll table into an oracle", () => {
    const table = `
    | dice: 1d6 | Result |
    | --------- | ------ |
    | 1-2       | [Action](starforged/oracles/core/action) |
    | 3-4       | [Theme](starforged/oracles/core/theme) |
    | 5-6       | Just foo |
    `;
    const expectedOracle: OracleTableSimple = {
      id: "custom/oracles/foo",
      name: "Foo",
      dice: "1d100",
      source: {
        authors: [{ name: "Test" }],
        date: "2023-12-22",
        license: "Foo",
        title: "Tests",
        url: "https://example.com",
      },
      column_labels: { roll: "Roll", result: "Result" },
      oracle_type: "table_simple",
      rows: [
        {
          id: "custom/oracles/foo/1-33",
          min: 1,
          max: 33,
          result: "[Action](starforged/oracles/core/action)",
          template: { result: "{{starforged/oracles/core/action}}" },
        },
        {
          id: "custom/oracles/foo/34-67",
          min: 34,
          max: 67,
          result: "[Theme](starforged/oracles/core/theme)",
          template: {
            result: "{{starforged/oracles/core/theme}}",
          },
        },
        {
          id: "custom/oracles/foo/68-100",
          min: 68,
          max: 100,
          result: "Just foo",
        },
      ],
    };
    expect(parseTable("custom/oracles/foo", table)).toEqual(expectedOracle);
  });
});
