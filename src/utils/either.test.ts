import { Either, Left, Right } from "./either";

describe("Left", () => {
  it("#map", () => {
    const value: Either<string, number> = Left.create("error");
    expect(value.map((x) => x + 1)).toEqual(Left.create("error"));
  });
});

describe("Right", () => {
  it("#map", () => {
    const value: Either<string, number> = Right.create(1);
    expect(value.map((x) => x + 1)).toEqual(Right.create(2));
  });
});
