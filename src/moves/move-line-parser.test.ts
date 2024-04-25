import { Either, Left, Right } from "../utils/either";
import { ActionMoveDescription } from "./desc";
import { parseMoveLine } from "./move-line-parser";

describe("parseMoveLine", () => {
  it.each<{ line: string; result: Either<string, ActionMoveDescription> }>([
    {
      line: "starforged/foo/bar: 3 +2{wits} vs 1, 3",
      result: Right.create({
        name: "starforged/foo/bar",
        action: 3,
        stat: "wits",
        statVal: 2,
        challenge1: 1,
        challenge2: 3,
        adds: [],
      }),
    },
    {
      line: "starforged/foo/bar: 3 +2{wits} +1{a long description (i did this)} vs 1, 3",
      result: Right.create({
        name: "starforged/foo/bar",
        action: 3,
        stat: "wits",
        statVal: 2,
        challenge1: 1,
        challenge2: 3,
        adds: [{ amount: 1, desc: "a long description (i did this)" }],
      }),
    },
  ])("parses a standard move line '$line'", ({ line, result }) => {
    expect(parseMoveLine(line)).toEqual(result);
  });

  it.each`
    line                                  | msg
    ${"starforged/foo/bar: 3 +2 vs 1, 3"} | ${"Expected: {"}
  `("rejects invalid line '$line'", ({ line, msg }) => {
    const result = parseMoveLine(line);
    expect(result).toMatchObject(Left.create(expect.stringMatching(msg)));
  });
});
