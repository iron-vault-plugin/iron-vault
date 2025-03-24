import { numberRange, parseRange, parseRanges } from "./numbers";

describe("numberRange", () => {
  it("lists numbers in positive range", () => {
    expect(numberRange(0, 5)).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it("lists numbers in negative range", () => {
    expect(numberRange(-5, 5)).toEqual([-5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5]);
  });

  it("lists numbers when from/to are backwards", () => {
    expect(numberRange(5, 0)).toEqual([0, 1, 2, 3, 4, 5]);
  });
});

describe("parseRange", () => {
  it.each`
    range      | min  | max
    ${"1"}     | ${1} | ${1}
    ${"1-2"}   | ${1} | ${2}
    ${"1 - 2"} | ${1} | ${2}
  `("parses range $range to min $min and max $max", ({ range, min, max }) => {
    const result = parseRange(range);
    expect(result).toEqual({
      min,
      max,
    });
  });

  it("returns undefined for invalid range", () => {
    const result = parseRange("invalid");
    expect(result).toBeUndefined();
  });
  it("returns undefined for empty string", () => {
    const result = parseRange("");
    expect(result).toBeUndefined();
  });
  it("returns undefined for non-numeric range", () => {
    const result = parseRange("1-foo");
    expect(result).toBeUndefined();
  });
});

describe("parseRanges", () => {
  it.each`
    range          | results
    ${"1"}         | ${[{ min: 1, max: 1 }]}
    ${"1-2"}       | ${[{ min: 1, max: 2 }]}
    ${"1;3 - 6"}   | ${[{ min: 1, max: 1 }, { min: 3, max: 6 }]}
    ${"1-2;3 - 6"} | ${[{ min: 1, max: 2 }, { min: 3, max: 6 }]}
  `("parses range $range to $results", ({ range, results }) => {
    const result = parseRanges(range);
    expect(result).toEqual(results);
  });
});
