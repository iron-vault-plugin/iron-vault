import {
  findAdjacentCodeBlock,
  findFirstNonWhitespace,
  splitTextIntoReverseLineIterator,
} from "./editor";

test.each`
  lines               | result
  ${["", " ", "foo"]} | ${["foo", 2]}
  ${["```", "", ""]}  | ${["```", 0]}
  ${["", ""]}         | ${null}
`(
  "findFirstNonWhitespace finds first-non whitespace in $lines",
  ({ lines, result }: { lines: string[]; result: number }) => {
    expect(
      findFirstNonWhitespace(
        lines.map((l, idx): [string, number] => [l, idx])[Symbol.iterator](),
      ),
    ).toStrictEqual(result);
  },
);

describe("findAdjacentCodeBlock", () => {
  it("finds the start and end of a block with only whitespace below it", () => {
    expect(
      findAdjacentCodeBlock(
        splitTextIntoReverseLineIterator("```\nasdf\n```\n \n\n"),
      ),
    ).toEqual({ from: { line: 0, ch: 0 }, to: { line: 3, ch: 0 } });
  });

  it("finds no block if non-whitespace intrudes", () => {
    expect(
      findAdjacentCodeBlock(
        splitTextIntoReverseLineIterator("```\nasdf\n```\n \na\n"),
      ),
    ).toEqual(null);
  });

  it("requires block type if provided", () => {
    expect(
      findAdjacentCodeBlock(
        splitTextIntoReverseLineIterator("```\nasdf\n```\n\n\n"),
        "mechanics",
      ),
    ).toEqual(null);

    expect(
      findAdjacentCodeBlock(
        splitTextIntoReverseLineIterator("```mechanics\nasdf\n```\n\n\n"),
        "mechanics",
      ),
    ).toEqual({ from: { line: 0, ch: 0 }, to: { line: 3, ch: 0 } });

    expect(
      findAdjacentCodeBlock(
        splitTextIntoReverseLineIterator(
          "```mechanics\nasdf\n```\n\n```\nthis block blocks\n```\n",
        ),
        "mechanics",
      ),
    ).toEqual(null);
  });
});
