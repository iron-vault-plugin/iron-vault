import { describe, expect, it } from "vitest";
import { IndexingMap, IndexingMultiMap } from "./invertible-map";

describe("IndexingMap", () => {
  it("indexes entries", () => {
    const map = new IndexingMap([
      ["path1", 1],
      ["path2", 2],
      ["path3", 2],
    ]);
    expect(map.getKeysForValue(2)).toMatchObject(new Set(["path2", "path3"]));
  });

  it("handles deletion", () => {
    const map = new IndexingMap([
      ["path1", 1],
      ["path2", 2],
      ["path3", 2],
    ]);
    expect(map.delete("path2")).toBe(true);
    expect(map.get("path2")).toBeUndefined();
    expect(map.getKeysForValue(2)).toMatchObject(new Set(["path3"]));
  });

  it("indexes nulls", () => {
    const map = new IndexingMap([
      ["path1", 1],
      ["path2", null],
      ["path3", null],
    ]);
    expect(map.getKeysForValue(null)).toMatchObject(
      new Set(["path2", "path3"]),
    );
  });
});

describe("IndexingMultiMap", () => {
  it("indexes entries", () => {
    const map = new IndexingMultiMap([
      ["path1", 1],
      ["path1", 2],
      ["path2", 2],
      ["path2", 3],
      ["path3", 4],
    ]);
    expect(map.getKeysForValue(2)).toMatchObject(new Set(["path1", "path2"]));
    expect(map.getKeysForValue(3)).toMatchObject(new Set(["path2"]));
    expect(map.get("path2")).toMatchObject(new Set([2, 3]));
    expect(map.get("path1")).toMatchObject(new Set([1, 2]));
  });

  it("handles deletion", () => {
    const map = new IndexingMultiMap([
      ["path1", 1],
      ["path2", 3],
      ["path2", 2],
      ["path3", 2],
    ]);
    expect(map.delete("path2")).toBe(true);
    expect(map.get("path2")).toBeUndefined();
    expect(map.getKeysForValue(2)).toMatchObject(new Set(["path3"]));
    expect(map.getKeysForValue(3)).toMatchObject(new Set());
  });

  describe("#set", () => {
    it("updates values in the map", () => {
      const map = new IndexingMultiMap([
        ["path1", 1],
        ["path2", 3],
        ["path2", 2],
        ["path3", 2],
      ]);
      map.set("path2", [1, 4]);
      expect(map.get("path2")).toMatchObject(new Set([1, 4]));
      expect(map.getKeysForValue(2)).toMatchObject(new Set(["path3"]));
      expect(map.getKeysForValue(3)).toMatchObject(new Set());
      expect(map.getKeysForValue(1)).toMatchObject(new Set(["path1", "path2"]));
    });
  });
});
