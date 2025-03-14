import { childOfPath, findTopLevelParent, parentFolderOf } from "./paths";

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
