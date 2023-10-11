import { PriorityIndexer } from "./priority-index";

describe("PriorityIndex", () => {
  const SOURCE_A = { key1: "sourceA_key1", key2: "sourceA_key2" };
  const SOURCE_B = { key1: "sourceB_key1", key3: "sourceB_key3" };

  it("returns the value for the lowest priority value", () => {
    const idx = new PriorityIndexer<string, string>();
    idx.indexSource("a", 1, SOURCE_A);
    idx.indexSource("b", 0, SOURCE_B);
    expect(idx.get("key1")).toEqual("sourceB_key1");
    expect(idx.get("key2")).toEqual("sourceA_key2");
  });
  it("does not consider unregistered sources", () => {
    const idx = new PriorityIndexer<string, string>();
    idx.indexSource("a", 1, SOURCE_A);
    idx.indexSource("b", 0, SOURCE_B);
    idx.removeSource("b");
    expect(idx.get("key1")).toEqual("sourceA_key1");
  });

  describe("keys", () => {
    it("includes all keys across all sources", () => {
      const idx = new PriorityIndexer<string, string>();
      idx.indexSource("a", 1, SOURCE_A);
      idx.indexSource("b", 0, SOURCE_B);
      expect(new Set(idx.keys())).toEqual(new Set(["key1", "key2", "key3"]));
    });
  });

  describe("values", () => {
    it("includes correct value for each key", () => {
      const idx = new PriorityIndexer<string, string>();
      idx.indexSource("a", 1, SOURCE_A);
      idx.indexSource("b", 0, SOURCE_B);
      expect(new Set(idx.values())).toEqual(
        new Set(["sourceB_key1", "sourceB_key3", "sourceA_key2"]),
      );
    });
  });

  describe("entries", () => {
    it("includes correct value for each key", () => {
      const idx = new PriorityIndexer<string, string>();
      idx.indexSource("a", 1, SOURCE_A);
      idx.indexSource("b", 0, SOURCE_B);
      expect(new Set(idx.entries())).toEqual(
        new Set([
          ["key1", "sourceB_key1"],
          ["key3", "sourceB_key3"],
          ["key2", "sourceA_key2"],
        ]),
      );
    });
  });

  it("reports the correct size after removes", () => {
    const idx = new PriorityIndexer<string, string>();
    idx.indexSource("a", 1, SOURCE_A);
    idx.indexSource("b", 0, SOURCE_B);

    expect(idx.size).toBe(3);

    idx.removeSource("b");
    expect(idx.size).toBe(2);

    idx.removeSource("a");
    expect(idx.size).toBe(0);
  });
});
