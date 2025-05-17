import { fail, str, succ } from ".";
import { alt, cut, permutation, permutationOptional } from "./branching";
import {
  Parser,
  RecoverableParserError,
  runParser,
  runParserPartial,
  UnrecoverableParserError,
} from "./parser";

describe("alt", () => {
  it("returns the result of the first parser that succeeds", () => {
    const parser = alt(fail("fail1"), succ("success"), () => {
      throw new Error("should not be called");
    });
    expect(runParserPartial(parser, "").unwrap()).toEqual(["success", [""]]);
  });

  it("returns the result of the first parser that succeeds, even if later parsers would also succeed", () => {
    const parser = alt(fail("fail1"), succ("success1"), succ("success2"));
    expect(runParserPartial(parser, "").unwrap()).toEqual(["success1", [""]]);
  });

  it("returns the unrecoverable error immediately if encountered", () => {
    const parser = alt(
      fail("fail1"),
      cut(fail("fatal error")),
      succ("should not be called"),
    );
    expect(runParser(parser, "").unwrapError()).toBeInstanceOf(
      UnrecoverableParserError,
    );
  });

  it("returns a recoverable error if all parsers fail recoverably", () => {
    const parser = alt(fail("fail1"), fail("fail2"), fail("fail3"));
    const error = runParser(parser, "").unwrapError();
    expect(error).toBeInstanceOf(RecoverableParserError);
    expect(error.message).toMatch(/No parsers succeeded/);
    expect(error.message).toMatch(/fail3/);
    expect(error.cause).toBeDefined();
  });
});

describe("permutationOptional", () => {
  it("parses all elements in any order", () => {
    const parser = permutationOptional(str("a"), str("b"), str("c"));
    expect(runParser(parser, "a", "b", "c").unwrap()).toEqual(["a", "b", "c"]);
    expect(runParser(parser, "a", "c", "b").unwrap()).toEqual(["a", "b", "c"]);
    expect(runParser(parser, "b", "a", "c").unwrap()).toEqual(["a", "b", "c"]);
    expect(runParser(parser, "c", "a", "b").unwrap()).toEqual(["a", "b", "c"]);
    expect(runParser(parser, "c", "b", "a").unwrap()).toEqual(["a", "b", "c"]);
  });

  it("returns undefined if a parser fails to match", () => {
    const parser = permutationOptional(str("a"), str("b"), str("c"));
    expect(runParser(parser, "c", "a").unwrap()).toEqual(["a", undefined, "c"]);
  });

  it("returns an unrecoverable error immediately if encountered", () => {
    const fatalParser: Parser<string, string> = cut(fail("fatal"));
    const parser = permutationOptional(str("a"), fatalParser, str("b"));
    const result = runParser(parser, "a", "c", "b");
    expect(result.isLeft()).toBe(true);
    expect(result.unwrapError()).toBeInstanceOf(UnrecoverableParserError);
  });

  it("works with a single parser", () => {
    const parser = permutationOptional(str("foo"));
    expect(runParserPartial(parser, "foo").unwrap()).toEqual([["foo"], []]);
    expect(runParserPartial(parser, "bar").unwrap()).toEqual([
      [undefined],
      ["bar"],
    ]);
  });

  it("returns an empty array if no parsers are given", () => {
    const parser = permutationOptional();
    expect(runParserPartial(parser, "anything").unwrap()).toEqual([
      [],
      ["anything"],
    ]);
  });
});

describe("permutation", () => {
  it("parses all elements in any order", () => {
    const parser = permutation(str("a"), str("b"), str("c"));
    expect(runParser(parser, "a", "b", "c").unwrap()).toEqual(["a", "b", "c"]);
    expect(runParser(parser, "a", "c", "b").unwrap()).toEqual(["a", "b", "c"]);
    expect(runParser(parser, "b", "a", "c").unwrap()).toEqual(["a", "b", "c"]);
    expect(runParser(parser, "c", "a", "b").unwrap()).toEqual(["a", "b", "c"]);
    expect(runParser(parser, "c", "b", "a").unwrap()).toEqual(["a", "b", "c"]);
  });

  it("returns an error if any parser fails to match", () => {
    const parser = permutation(str("a"), str("b"), str("c"));
    expect(runParser(parser, "c", "x", "a").unwrapError().message).toMatch(
      /No parsers succeeded in permutation/,
    );
  });

  it("returns an unrecoverable error immediately if encountered", () => {
    const fatalParser: Parser<string, string> = cut(fail("fatal"));
    const parser = permutation(str("a"), fatalParser, str("b"));
    const result = runParser(parser, "a", "c", "b");
    expect(result.isLeft()).toBe(true);
    expect(result.unwrapError()).toBeInstanceOf(UnrecoverableParserError);
  });

  it("works with a single parser", () => {
    const parser = permutation(str("foo"));
    expect(runParser(parser, "foo").unwrap()).toEqual(["foo"]);
    expect(runParser(parser, "bar").isLeft()).toBe(true);
  });

  it("returns an empty array if no parsers are given", () => {
    const parser = permutation();
    expect(runParserPartial(parser, "anything").unwrap()).toEqual([
      [],
      ["anything"],
    ]);
  });
});
