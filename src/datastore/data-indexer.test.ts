import { projectedVersionedMap } from "utils/versioned-map";

describe("projectedVersionedMap", () => {
  it("omits entries that return undefined", () => {
    const inner = Object.assign(
      new Map([
        ["a", 1],
        ["b", 2],
      ]),
      { revision: 1 },
    );
    const projected = projectedVersionedMap(inner, (num) =>
      num % 2 == 0 ? num : undefined,
    );
    expect([...projected.entries()]).toEqual([["b", 2]]);
  });

  it("transforms entries", () => {
    const inner = Object.assign(
      new Map([
        ["a", 1],
        ["b", 2],
      ]),
      { revision: 1 },
    );
    const projected = projectedVersionedMap(inner, (num) =>
      (num + 2).toString(),
    );
    expect([...projected.entries()]).toEqual([
      ["a", "3"],
      ["b", "4"],
    ]);
  });

  it("stays in sync with inner map", () => {
    const inner = Object.assign(
      new Map([
        ["a", 1],
        ["b", 2],
      ]),
      { revision: 1 },
    );
    const projected = projectedVersionedMap(inner, (num) =>
      num % 2 == 0 ? num : undefined,
    );

    inner.set("c", 3).set("d", 4);

    expect([...projected.entries()]).toEqual([
      ["b", 2],
      ["d", 4],
    ]);
  });
});
