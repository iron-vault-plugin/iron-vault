import { preceded, runParser, str, succ } from ".";
import { consumeAll } from "./sequences";

describe("preceded", () => {
  it("returns the result of the second parser and discards the first", () => {
    const parser = preceded(succ<"first", string>("first"), str("root"));
    expect(runParser(parser, "root").unwrap()).toBe("root");
  });

  it("returns error if the first parser fails", () => {
    const parser = preceded(str("first"), str("second"));

    expect(runParser(parser, "second", "second").unwrapError().message).toMatch(
      /expected string "first"; found "second"/,
    );
  });

  it("returns error if the second parser fails", () => {
    const precededParser = preceded(str("first"), str("second"));

    expect(
      runParser(precededParser, "first", "third").unwrapError().message,
    ).toMatch(/expected string "second"; found "third"/);
  });

  it("passes the correct node through the sequence", () => {
    const precededParser = preceded(str("first"), str("second"));

    expect(runParser(precededParser, "first", "second").unwrap()).toBe(
      "second",
    );
  });
});

describe("consumeAll", () => {
  it("returns all node values in order", () => {
    const result = runParser(consumeAll, "a", "b", "c");
    expect(result.unwrap()).toEqual(["a", "b", "c"]);
  });

  it("returns empty array if node is undefined", () => {
    const result = runParser(consumeAll);
    expect(result.unwrap()).toEqual([]);
  });
});
