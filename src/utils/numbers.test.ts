import { numberRange } from "./numbers";

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
