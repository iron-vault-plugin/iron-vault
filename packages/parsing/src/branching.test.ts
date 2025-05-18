import { unwrap, unwrapErr } from "true-myth/test-support";
import { describe, expect, it } from "vitest";
import { alt, cut, permutation, permutationOptional } from "./branching";
import { fail, str, succ } from "./index";
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
    expect(unwrap(runParserPartial(parser, ""))).toEqual(["success", [""]]);
  });

  it("returns the result of the first parser that succeeds, even if later parsers would also succeed", () => {
    const parser = alt(fail("fail1"), succ("success1"), succ("success2"));
    expect(unwrap(runParserPartial(parser, ""))).toEqual(["success1", [""]]);
  });

  it("returns the unrecoverable error immediately if encountered", () => {
    const parser = alt(
      fail("fail1"),
      cut(fail("fatal error")),
      succ("should not be called"),
    );
    expect(unwrapErr(runParser(parser, ""))).toBeInstanceOf(
      UnrecoverableParserError,
    );
  });

  it("returns a recoverable error if all parsers fail recoverably", () => {
    const parser = alt(fail("fail1"), fail("fail2"), fail("fail3"));
    const error = unwrapErr(runParser(parser, ""));
    expect(error).toBeInstanceOf(RecoverableParserError);
    expect(error.message).toMatch(/No parsers succeeded/);
    expect(error.message).toMatch(/fail3/);
    expect(error.cause).toBeDefined();
  });
});

describe("permutationOptional", () => {
  it("parses all elements in any order", () => {
    const parser = permutationOptional(str("a"), str("b"), str("c"));
    expect(unwrap(runParser(parser, "a", "b", "c"))).toEqual(["a", "b", "c"]);
    expect(unwrap(runParser(parser, "a", "c", "b"))).toEqual(["a", "b", "c"]);
    expect(unwrap(runParser(parser, "b", "a", "c"))).toEqual(["a", "b", "c"]);
    expect(unwrap(runParser(parser, "c", "a", "b"))).toEqual(["a", "b", "c"]);
    expect(unwrap(runParser(parser, "c", "b", "a"))).toEqual(["a", "b", "c"]);
  });

  it("returns undefined if a parser fails to match", () => {
    const parser = permutationOptional(str("a"), str("b"), str("c"));
    expect(unwrap(runParser(parser, "c", "a"))).toEqual(["a", undefined, "c"]);
  });

  it("returns an unrecoverable error immediately if encountered", () => {
    const fatalParser: Parser<string, string> = cut(fail("fatal"));
    const parser = permutationOptional(str("a"), fatalParser, str("b"));
    const result = runParser(parser, "a", "c", "b");
    expect(unwrapErr(result)).toBeInstanceOf(UnrecoverableParserError);
  });

  it("works with a single parser", () => {
    const parser = permutationOptional(str("foo"));
    expect(unwrap(runParserPartial(parser, "foo"))).toEqual([["foo"], []]);
    expect(unwrap(runParserPartial(parser, "bar"))).toEqual([
      [undefined],
      ["bar"],
    ]);
  });

  it("returns an empty array if no parsers are given", () => {
    const parser = permutationOptional();
    expect(unwrap(runParserPartial(parser, "anything"))).toEqual([
      [],
      ["anything"],
    ]);
  });
});

describe("permutation", () => {
  it("parses all elements in any order", () => {
    const parser = permutation(str("a"), str("b"), str("c"));
    expect(unwrap(runParser(parser, "a", "b", "c"))).toEqual(["a", "b", "c"]);
    expect(unwrap(runParser(parser, "a", "c", "b"))).toEqual(["a", "b", "c"]);
    expect(unwrap(runParser(parser, "b", "a", "c"))).toEqual(["a", "b", "c"]);
    expect(unwrap(runParser(parser, "c", "a", "b"))).toEqual(["a", "b", "c"]);
    expect(unwrap(runParser(parser, "c", "b", "a"))).toEqual(["a", "b", "c"]);
  });

  it("returns an error if any parser fails to match", () => {
    const parser = permutation(str("a"), str("b"), str("c"));
    expect(unwrapErr(runParser(parser, "c", "x", "a")).message).toMatch(
      /No parsers succeeded in permutation/,
    );
  });

  it("returns an unrecoverable error immediately if encountered", () => {
    const fatalParser: Parser<string, string> = cut(fail("fatal"));
    const parser = permutation(str("a"), fatalParser, str("b"));
    const result = runParser(parser, "a", "c", "b");
    expect(unwrapErr(result)).toBeInstanceOf(UnrecoverableParserError);
  });

  it("works with a single parser", () => {
    const parser = permutation(str("foo"));
    expect(unwrap(runParser(parser, "foo"))).toEqual(["foo"]);
    expect(runParser(parser, "bar").isErr).toBe(true);
  });

  it("returns an empty array if no parsers are given", () => {
    const parser = permutation();
    expect(unwrap(runParserPartial(parser, "anything"))).toEqual([
      [],
      ["anything"],
    ]);
  });
});
