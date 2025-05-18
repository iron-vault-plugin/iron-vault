import { describe, expect, it } from "vitest";

import { unwrap, unwrapErr } from "true-myth/test-support";
import { preceded, runParser, str, succ } from ".";
import { consumeAll } from "./sequences";

describe("preceded", () => {
  it("returns the result of the second parser and discards the first", () => {
    const parser = preceded(succ<"first", string>("first"), str("root"));
    expect(unwrap(runParser(parser, "root"))).toBe("root");
  });

  it("returns error if the first parser fails", () => {
    const parser = preceded(str("first"), str("second"));

    expect(unwrapErr(runParser(parser, "second", "second")).message).toMatch(
      /expected string "first"; found "second"/,
    );
  });

  it("returns error if the second parser fails", () => {
    const precededParser = preceded(str("first"), str("second"));

    expect(
      unwrapErr(runParser(precededParser, "first", "third")).message,
    ).toMatch(/expected string "second"; found "third"/);
  });

  it("passes the correct node through the sequence", () => {
    const precededParser = preceded(str("first"), str("second"));

    expect(unwrap(runParser(precededParser, "first", "second"))).toBe("second");
  });
});

describe("consumeAll", () => {
  it("returns all node values in order", () => {
    const result = runParser(consumeAll, "a", "b", "c");
    expect(unwrap(result)).toEqual(["a", "b", "c"]);
  });

  it("returns empty array if node is undefined", () => {
    const result = runParser(consumeAll);
    expect(unwrap(result)).toEqual([]);
  });
});
