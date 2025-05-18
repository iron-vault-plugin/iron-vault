import { unwrap, unwrapErr } from "true-myth/test-support";
import { describe, expect, it } from "vitest";
import { runParser } from "./parser";
import { regex, str } from "./strings";

describe("str", () => {
  describe("when given a single string", () => {
    it("matches a simple string", () => {
      const parser = str("foo");
      expect(unwrap(runParser(parser, "foo"))).toEqual("foo");
    });

    it("fails if the string does not match", () => {
      const parser = str("foo");
      expect(unwrapErr(runParser(parser, "foobar")).message).toMatch(
        /expected string "foo"; found "foobar"/,
      );
    });
  });

  describe("when given multiple strings", () => {
    it("matches any of the strings", () => {
      const parser = str("foo", "bar");
      expect(unwrap(runParser(parser, "foo"))).toEqual("foo");
      expect(unwrap(runParser(parser, "bar"))).toEqual("bar");
    });

    it("fails if none of the strings match", () => {
      const parser = str("foo", "bar");
      expect(unwrapErr(runParser(parser, "baz")).message).toMatch(
        /expected string "foo", "bar"; found "baz"/,
      );
    });
  });

  describe("when given no strings", () => {
    it("matches any string", () => {
      const parser = str();
      expect(unwrap(runParser(parser, "anything"))).toEqual("anything");
    });

    it("fails if the input is empty", () => {
      const parser = str();
      expect(unwrapErr(runParser(parser)).message).toMatch(
        /expected string, found end-of-sequence/,
      );
    });
  });
});

describe("regex", () => {
  it("matches a simple regex", () => {
    const parser = regex(/foo/);
    expect(unwrap(runParser(parser, "foo"))).toEqual(["foo"]);
  });

  it("fails if the regex does not match", () => {
    const parser = regex(/foo/);
    expect(unwrapErr(runParser(parser, "bar")).message).toMatch(
      /expected string to match regex \/foo\/, found "bar"/,
    );
  });

  it("matches a regex with flags", () => {
    const parser = regex(/foo/i);
    expect(unwrap(runParser(parser, "FOO"))).toEqual(["FOO"]);
  });

  it("passes capture groups through", () => {
    const parser = regex(/(foo)(bar)/);
    expect(unwrap(runParser(parser, "foobar"))).toEqual([
      "foobar",
      "foo",
      "bar",
    ]);
  });
});
