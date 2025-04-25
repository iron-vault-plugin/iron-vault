import { preceded, runParser, str, succ } from ".";

describe("preceded", () => {
  it("returns the result of the second parser and discards the first", () => {
    const parser = preceded(succ("first"), succ("second"));
    expect(runParser(parser, "root").unwrap()).toBe("second");
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
