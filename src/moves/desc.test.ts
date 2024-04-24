import { ActionMoveDescription, parseMove } from "./desc";

describe("parseMove", () => {
  it.each<{ line: string; result: ActionMoveDescription }>([
    {
      line: "starforged/foo/bar: 3 +2{wits} vs 1, 3",
      result: {
        name: "starforged/foo/bar",
        action: 3,
        stat: "wits",
        statVal: 2,
        challenge1: 1,
        challenge2: 3,
        adds: 0,
      },
    },
    {
      line: "starforged/foo/bar: 3 +2{wits} +1{a long description (i did this)} vs 1, 3",
      result: {
        name: "starforged/foo/bar",
        action: 3,
        stat: "wits",
        statVal: 2,
        challenge1: 1,
        challenge2: 3,
        adds: 1,
      },
    },
  ])("parses a standard move line $line", ({ line, result }) => {
    expect(parseMove(line)).toEqual(result);
  });
});
