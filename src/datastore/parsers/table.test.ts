import {
  MalformedMarkdownTableError,
  MarkdownTableAlignment,
  matchTable,
  matchTables,
  splitTableRow,
} from "./table";

describe("splitTableRow", () => {
  it("splits unenclosed rows", () => {
    expect(splitTableRow(" a | b | c  ")).toEqual(["a", "b", "c"]);
  });

  it("removes first leading and trailing empties", () => {
    expect(splitTableRow(" || a | b | c |")).toEqual(["", "a", "b", "c"]);
  });
});

describe("matchTable", () => {
  it("matches a table with enclosing pipes", () => {
    const row = "| foo | bar |\n| -- | -- |\n| asd | sdf |\n";
    expect(matchTable(row)).toEqual({
      columnAlignments: [
        MarkdownTableAlignment.Default,
        MarkdownTableAlignment.Default,
      ],
      header: ["foo", "bar"],
      body: [["asd", "sdf"]],
    });
  });

  it("matches a table without enclosing pipes", () => {
    const row = " foo | bar \n --|-- \n asd | sdf \n bar |baz";
    expect(matchTable(row)).toEqual({
      columnAlignments: [
        MarkdownTableAlignment.Default,
        MarkdownTableAlignment.Default,
      ],
      header: ["foo", "bar"],
      body: [
        ["asd", "sdf"],
        ["bar", "baz"],
      ],
    });
  });

  it("matches a table with leading whitespace", () => {
    const row =
      "   | foo | bar |\n    | --|-- |\n    | asd | sdf |\n | bar |baz |";
    expect(matchTable(row)).toEqual({
      columnAlignments: [
        MarkdownTableAlignment.Default,
        MarkdownTableAlignment.Default,
      ],
      header: ["foo", "bar"],
      body: [
        ["asd", "sdf"],
        ["bar", "baz"],
      ],
    });
  });

  it("ignores excess columns in data", () => {
    const row = " foo | bar \n --|-- \n asd | sdf \n bar |baz | boom";
    expect(matchTable(row)).toEqual({
      columnAlignments: [
        MarkdownTableAlignment.Default,
        MarkdownTableAlignment.Default,
      ],
      header: ["foo", "bar"],
      body: [
        ["asd", "sdf"],
        ["bar", "baz"],
      ],
    });
  });

  it("does not match a table with mismatched header and divider rows", () => {
    const row = "| foo | bar |\n| -- | -- | -- |\n| asd | sdf |\n";
    expect(() => matchTable(row)).toThrow(
      new MalformedMarkdownTableError("header has 2 cols, but divider has 3"),
    );
  });

  it("does not match a table with mismatched pipes", () => {
    const row = " foo | bar |\n| -- | -- |\n| asd | sdf |\n";
    expect(() => matchTable(row)).toThrow(
      new MalformedMarkdownTableError("no table found"),
    );
  });
});

describe("matchTables", () => {
  it("finds all tables in content", () => {
    expect(
      matchTables(`
    | asd | bsd |
    | --- | --- |
    | 1 |  |

    | 2sd | 2sd |
    | --- | --- |
    | 2 |  |
    `),
    ).toMatchObject([{ header: ["asd", "bsd"] }, { header: ["2sd", "2sd"] }]);
  });

  it("finds a table in a markdown file", () => {
    expect(
      matchTables(
        "---\nforged: inline-oracle\n---\n| dice: 1d6 | Result | \n| --------- | ------ | \n| 1-2       | [Action](id:asdf/asdf) |\n| 3-4       | [Theme](id:asdf) |\n| 5-6       | Just foo |\n",
      ),
    ).toHaveLength(1);
  });
});
