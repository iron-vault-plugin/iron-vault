import { describe, expect, it } from "vitest";
import {
  childOfPath,
  directChildOfPath,
  findTopLevelParent,
  parentFolderOf,
} from "./paths";

describe("childOfPath", () => {
  it.each`
    root     | child           | result
    ${"/"}   | ${"asdf.md"}    | ${true}
    ${"/"}   | ${"foo/bar.md"} | ${true}
    ${"foo"} | ${"foo/bar.md"} | ${true}
    ${"foo"} | ${"bar.md"}     | ${false}
    ${"foo"} | ${"bar/foo"}    | ${false}
  `("returns $result for $root of $child", ({ root, child, result }) => {
    expect(childOfPath(root, child)).toBe(result);
  });
});

describe("childOfPath", () => {
  it.each`
    path                | parent
    ${"asdf.md"}        | ${"/"}
    ${"foo/bar.md"}     | ${"foo"}
    ${"foo/bar/baz.md"} | ${"foo/bar"}
  `("returns $result for $root of $child", ({ path, parent }) => {
    expect(parentFolderOf(path)).toBe(parent);
  });
});

describe("findTopLevelParent", () => {
  it.each`
    root          | path                                 | expected
    ${"world"}    | ${"world/continent/country/city.md"} | ${"continent"}
    ${"world"}    | ${"world/region.md"}                 | ${"region.md"}
    ${"world"}    | ${"other/path/file.md"}              | ${undefined}
    ${"world/"}   | ${"world/continent/file.md"}         | ${"continent"}
    ${"docs"}     | ${"docs/folder/subfolder/file.md"}   | ${"folder"}
    ${"project/"} | ${"project/src/file.ts"}             | ${"src"}
  `(
    "finds top level parent for root=$root path=$path",
    ({ root, path, expected }) => {
      expect(findTopLevelParent(root, path)).toEqual(expected);
    },
  );
});

describe("directChildOfPath", () => {
  it.each`
    root          | child                         | result
    ${"/"}        | ${"file.md"}                  | ${true}
    ${"/"}        | ${"/file.md"}                 | ${true}
    ${"/"}        | ${"folder/file.md"}           | ${false}
    ${"folder"}   | ${"folder/file.md"}           | ${true}
    ${"folder"}   | ${"folder/subfolder/file.md"} | ${false}
    ${"folder"}   | ${"otherFolder/file.md"}      | ${false}
    ${"folder/"}  | ${"folder/file.md"}           | ${true}
    ${"project/"} | ${"project/file.ts"}          | ${true}
    ${"project/"} | ${"project/src/file.ts"}      | ${false}
    ${"project"}  | ${"project"}                  | ${false}
  `(
    "returns $result for root=$root and child=$child",
    ({ root, child, result }) => {
      expect(directChildOfPath(root, child)).toBe(result);
    },
  );
});
