import { describe, expect, it } from "vitest";

import {
  extractDataswornLinkParts,
  matchDataswornLink,
  parseDataswornLinks,
  ParsedDataswornId,
} from "./id";

describe("extractDataswornLinkParts", () => {
  const VALID_TEST_CASES: [string, ParsedDataswornId][] = [
    [
      "asset:starforged/path/empath",
      {
        kind: "asset",
        path: "starforged/path/empath",
        id: "asset:starforged/path/empath",
      },
    ],
    [
      "asset.ability.move:starforged/path/empath.0.read_heart",
      {
        kind: "asset.ability.move",
        path: "starforged/path/empath.0.read_heart",
        id: "asset.ability.move:starforged/path/empath.0.read_heart",
      },
    ],
  ];

  it.each(VALID_TEST_CASES)("matches old-style link '%s'", (link, result) => {
    expect(extractDataswornLinkParts(link)).toEqual(result);
  });

  it.each(VALID_TEST_CASES)(
    "matches new-style link 'datasworn:%s'",
    (link, result) => {
      expect(extractDataswornLinkParts("datasworn:" + link)).toEqual(result);
    },
  );

  it.each([
    ["http://asdf", null],
    ["./foo", null],
  ])("returns null for '%s'", (link, result) => {
    expect(extractDataswornLinkParts(link)).toEqual(result);
  });
});

describe("matchDataswornLink", () => {
  it.each`
    text                                                     | result
    ${"[Foo](datasworn:asset:starforged/path/empath)"}       | ${{ label: "Foo", id: "asset:starforged/path/empath" }}
    ${"[Foo  With  Spaces -](asset:starforged/path/empath)"} | ${{ label: "Foo  With  Spaces -", id: "asset:starforged/path/empath" }}
    ${"[Foo](https://foo)"}                                  | ${null}
    ${"datasworn:asset:starforged/path/empath"}              | ${null}
  `(
    "should handle '%s'",
    ({
      text,
      result,
    }: {
      text: string;
      result: ReturnType<typeof matchDataswornLink>;
    }) => {
      expect(matchDataswornLink(text)).toEqual(result);
    },
  );
});

describe("parseDataswornLinks", () => {
  it("parses datasworn links", () => {
    expect(
      parseDataswornLinks(
        "before[text](datasworn:oracle_rollable:foo/bar)after[text2](datasworn:oracle_rollable:foo/baz) end",
      ),
    ).toEqual([
      "before",
      {
        match: "[text](datasworn:oracle_rollable:foo/bar)",
        label: "text",
        id: "oracle_rollable:foo/bar",
      },
      "after",
      {
        match: "[text2](datasworn:oracle_rollable:foo/baz)",
        label: "text2",
        id: "oracle_rollable:foo/baz",
      },
      " end",
    ]);
  });
});
