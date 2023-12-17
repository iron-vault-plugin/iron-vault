import { OracleTable } from "dataforged";
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
    const expectedOracle: OracleTable = {
      $id: "custom/oracles/foo",
      Title: {
        $id: "custom/oracles/foo/title",
        Canonical: "Foo",
        Short: "Foo",
        Standard: "Foo",
      },
      Table: [
        {
          $id: "custom/oracles/foo/1-33",
          Floor: 1,
          Ceiling: 33,
          Result: "[Action](starforged/oracles/core/action)",
          "Roll template": {
            $id: "custom/oracles/foo/1-2/roll_template",
            Result: "{{starforged/oracles/core/action}}",
          },
        },
        {
          $id: "custom/oracles/foo/34-67",
          Floor: 34,
          Ceiling: 67,
          Result: "[Theme](starforged/oracles/core/theme)",
          "Roll template": {
            $id: "custom/oracles/foo/3-4/roll_template",
            Result: "{{starforged/oracles/core/theme}}",
          },
        },
        {
          $id: "custom/oracles/foo/68-100",
          Floor: 68,
          Ceiling: 100,
          Result: "Just foo",
        },
      ],
    };
    expect(parseTable("custom/oracles/foo", table)).toEqual(expectedOracle);
  });
});
