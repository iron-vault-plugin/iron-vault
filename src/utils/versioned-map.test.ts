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
