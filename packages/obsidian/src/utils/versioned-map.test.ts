import { describe, expect, it } from "vitest";
import { VersionedMapImpl } from "./versioned-map";

describe("VersionedMapImpl", () => {
  it("increments the revision when making changes", () => {
    const map = new VersionedMapImpl<string, number>();
    expect(map.revision).toBe(0);

    map.set("foo", 1);
    expect(map.revision).toBe(1);

    map.set("bar", 2);
    expect(new Set(map.keys())).toEqual(new Set(["foo", "bar"]));
    expect(map.revision).toBe(2);

    map.delete("baz");
    expect(map.revision).toBe(2); // revision stays the same if no change is made

    map.delete("bar");
    expect(new Set(map.keys())).toEqual(new Set(["foo"]));
    expect(map.revision).toBe(3);

    map.clear();
    expect(map.size).toBe(0);
    expect(map.revision).toBe(4);
  });

  describe("#asSingleRevision", () => {
    it("allows incrementing the revision only once", () => {
      const map = new VersionedMapImpl<string, number>();

      expect(map.revision).toBe(0);
      map.asSingleRevision((map) => map.set("foo", 1).set("bar", 2));
      expect(map.revision).toBe(1);
    });

    it("uses the correct revision number even if an error is thrown", () => {
      const map = new VersionedMapImpl<string, number>();

      expect(map.revision).toBe(0);
      expect(() =>
        map.asSingleRevision((map) => {
          map.set("foo", 1).set("bar", 2);
          throw new Error("oops");
        }),
      ).toThrow("oops");
      expect(map.revision).toBe(1);
    });

    it("behaves as expected when nested", () => {
      const map = new VersionedMapImpl<string, number>();

      expect(map.revision).toBe(0);
      map.asSingleRevision((map) => {
        map.set("foo", 1).set("bar", 2);
        map.asSingleRevision((map) => map.set("baz", 3).set("boop", 4));
        map.set("bing", 5);
      });
      expect(map.revision).toBe(1);
    });
  });
});
describe("ProjectedVersionedMap", () => {
  describe("#entries", () => {
    it("returns projected entries", () => {
      const baseMap = new VersionedMapImpl<string, number>();
      baseMap.set("a", 1);
      baseMap.set("b", 2);
      baseMap.set("c", 3);

      const projected = baseMap.projected((value) =>
        value > 1 ? value * 10 : undefined,
      );

      const entries = [...projected.entries()];
      expect(entries).toEqual([
        ["b", 20],
        ["c", 30],
      ]);
    });

    it("handles changes in underlying map", () => {
      const baseMap = new VersionedMapImpl<string, number>();
      baseMap.set("a", 1);
      baseMap.set("b", 2);
      baseMap.set("c", 3);

      const projected = baseMap.projected((value) =>
        value > 1 ? value * 10 : undefined,
      );

      const entries = [...projected.entries()];
      expect(entries).toEqual([
        ["b", 20],
        ["c", 30],
      ]);

      baseMap.set("d", 4); // This should add "d" to the projected map
      expect([...projected.entries()]).toEqual([
        ["b", 20],
        ["c", 30],
        ["d", 40],
      ]);

      baseMap.set("b", 1); // This should remove "b" from the projected map
      expect([...projected.entries()]).toEqual([
        ["c", 30],
        ["d", 40],
      ]);

      baseMap.delete("c"); // This should remove "c" from the projected map
      expect([...projected.entries()]).toEqual([["d", 40]]);

      baseMap.clear(); // This should clear the projected map
      expect([...projected.entries()]).toEqual([]);
    });
  });

  describe("#forEach", () => {
    it("iterates over filtered values", () => {
      const baseMap = new VersionedMapImpl<string, number>();
      baseMap.set("a", 1);
      baseMap.set("b", 2);
      baseMap.set("c", 3);

      const projected = baseMap.projected((value) =>
        value > 1 ? value * 10 : undefined,
      );

      const result: Record<string, number> = {};
      projected.forEach((value, key) => {
        result[key] = value;
      });

      expect(result).toEqual({ b: 20, c: 30 });
    });

    it("applies thisArg correctly", () => {
      const baseMap = new VersionedMapImpl<string, number>();
      baseMap.set("a", 1);
      baseMap.set("b", 2);

      const context = { multiplier: 10 };
      const result: Record<string, number> = {};

      const projected = baseMap.projected((value) => value);
      projected.forEach(function (this: typeof context, value, key) {
        result[key] = value * this.multiplier;
      }, context);

      expect(result).toEqual({ a: 10, b: 20 });
    });

    it("handles empty maps", () => {
      const baseMap = new VersionedMapImpl<string, number>();
      const projected = baseMap.projected((value) => value * 2);

      const result: Record<string, number> = {};
      projected.forEach((value, key) => {
        result[key] = value;
      });

      expect(result).toEqual({});
    });

    it("passes the projected map as the third parameter", () => {
      const baseMap = new VersionedMapImpl<string, number>();
      baseMap.set("a", 1);

      const projected = baseMap.projected((value) => value * 2);

      let passedMap: ReadonlyMap<string, number> | undefined;
      projected.forEach((_, __, map) => {
        passedMap = map;
      });

      expect(passedMap).toBe(projected);
    });
  });
});
