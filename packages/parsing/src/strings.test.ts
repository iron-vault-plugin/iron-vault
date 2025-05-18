import { runParser } from "./parser";
import { regex, str } from "./strings";

describe("str", () => {
  describe("when given a single string", () => {
    it("matches a simple string", () => {
      const parser = str("foo");
      expect(runParser(parser, "foo").unwrap()).toEqual("foo");
    });

    it("fails if the string does not match", () => {
      const parser = str("foo");
      expect(runParser(parser, "foobar").unwrapError().message).toMatch(
        /expected string "foo"; found "foobar"/,
      );
    });
  });

  describe("when given multiple strings", () => {
    it("matches any of the strings", () => {
      const parser = str("foo", "bar");
      expect(runParser(parser, "foo").unwrap()).toEqual("foo");
      expect(runParser(parser, "bar").unwrap()).toEqual("bar");
    });

    it("fails if none of the strings match", () => {
      const parser = str("foo", "bar");
      expect(runParser(parser, "baz").unwrapError().message).toMatch(
        /expected string "foo", "bar"; found "baz"/,
      );
    });
  });

  describe("when given no strings", () => {
    it("matches any string", () => {
      const parser = str();
      expect(runParser(parser, "anything").unwrap()).toEqual("anything");
    });

    it("fails if the input is empty", () => {
      const parser = str();
      expect(runParser(parser).unwrapError().message).toMatch(
        /expected string, found end-of-sequence/,
      );
    });
  });
});

describe("regex", () => {
  it("matches a simple regex", () => {
    const parser = regex(/foo/);
    expect(runParser(parser, "foo").unwrap()).toEqual(["foo"]);
  });

  it("fails if the regex does not match", () => {
    const parser = regex(/foo/);
    expect(runParser(parser, "bar").unwrapError().message).toMatch(
      /expected string to match regex \/foo\/, found "bar"/,
    );
  });

  it("matches a regex with flags", () => {
    const parser = regex(/foo/i);
    expect(runParser(parser, "FOO").unwrap()).toEqual(["FOO"]);
  });

  it("passes capture groups through", () => {
    const parser = regex(/(foo)(bar)/);
    expect(runParser(parser, "foobar").unwrap()).toEqual([
      "foobar",
      "foo",
      "bar",
    ]);
  });
});
