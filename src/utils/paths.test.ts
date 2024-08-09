import { childOfPath, parentFolderOf } from "./paths";

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
