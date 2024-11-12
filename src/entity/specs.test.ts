import { evaluateSlotId, parseIdForAttributes } from "./specs";

describe("parseIdForAttributes", () => {
  it("yields expected pieces", () => {
    expect([...parseIdForAttributes("test/{{ foo }}/bar")]).toEqual([
      "test/",
      { id: "foo" },
      "/bar",
    ]);
  });

  it("works at start", () => {
    expect([...parseIdForAttributes("{{foo}}/test/bar")]).toEqual([
      { id: "foo" },
      "/test/bar",
    ]);
  });

  it("works at end", () => {
    expect([...parseIdForAttributes("test/bar/{{ foo }}")]).toEqual([
      "test/bar/",
      { id: "foo" },
    ]);
  });

  it("passes strings without attributes through unmodified", () => {
    expect([...parseIdForAttributes("test/foo/bar")]).toEqual(["test/foo/bar"]);
  });
});

describe("evaluateSlotId", () => {
  it("is undefined if missing field", () => {
    expect(
      evaluateSlotId("test/{{ foo }}/bar", () => undefined),
    ).toBeUndefined();
  });

  it("returns substituted id otherwise", () => {
    expect(
      evaluateSlotId("test/{{ foo }}/bar", (id) =>
        id === "foo" ? "val" : undefined,
      ),
    ).toEqual("test/val/bar");
  });
});
