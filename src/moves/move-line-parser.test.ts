import { Either, Left, Right } from "utils/either";
import { MoveDescription } from "./desc";
import { generateMoveLine, parseMoveLine } from "./move-line-parser";

describe("parseMoveLine", () => {
  it.each<{ line: string; result: Either<string, MoveDescription> }>([
    {
      line: "starforged/foo/bar: action 3 +2{wits} vs 1, 3",
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
      line: "starforged/foo/bar: action 3 +2{wits} +1{a long description (i did this)} vs 1, 3",
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
    {
      line: "starforged/foo/bar: action 3 +2{wits} vs 1, 3 (burn: 2>4)",
      result: Right.create({
        name: "starforged/foo/bar",
        action: 3,
        stat: "wits",
        statVal: 2,
        challenge1: 1,
        challenge2: 3,
        adds: [],
        burn: { orig: 2, reset: 4 },
      }),
    },
    {
      line: "starforged/foo: progress 5{trackid/asdf} vs 2, 4",
      result: Right.create({
        name: "starforged/foo",
        progressTicks: 5,
        progressTrack: "trackid/asdf",
        challenge1: 2,
        challenge2: 4,
      }),
    },
  ])("parses a standard move line '$line'", ({ line, result }) => {
    expect(parseMoveLine(line)).toEqual(result);
  });

  it.each`
    line                                         | msg
    ${"starforged/foo/bar: action 3 +2 vs 1, 3"} | ${"Expected: {"}
  `("rejects invalid line '$line'", ({ line, msg }) => {
    const result = parseMoveLine(line);
    expect(result).toMatchObject(Left.create(expect.stringMatching(msg)));
  });
});

describe("generateMoveLine", () => {
  it("round trips an action line", () => {
    const move: MoveDescription = {
      name: "starforged/foo/bar",
      action: 3,
      stat: "wits",
      statVal: 2,
      challenge1: 1,
      challenge2: 3,
      adds: [],
      burn: { orig: 2, reset: 4 },
    };
    expect(parseMoveLine(generateMoveLine(move))).toEqual(Right.create(move));
  });

  it("round trips a progress line", () => {
    const move: MoveDescription = {
      name: "starforged/foo",
      progressTicks: 5,
      progressTrack: "trackid/asdf",
      challenge1: 2,
      challenge2: 4,
    };
    expect(parseMoveLine(generateMoveLine(move))).toEqual(Right.create(move));
  });
});
