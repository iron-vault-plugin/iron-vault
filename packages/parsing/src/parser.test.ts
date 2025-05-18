import { describe, expect, it } from "vitest";

import { err, ok } from "true-myth/result";
import { unwrap, unwrapErr } from "true-myth/test-support";
import { Parser, RecoverableParserError, runParser } from "./parser";

describe("runParser", () => {
  type Node = string;

  it("returns Right with value when parser succeeds and consumes all nodes", () => {
    const parser: Parser<number, Node> = (node) => {
      if (node && node.value === "a" && !node.next) {
        return ok({ value: 42, start: node, next: undefined });
      }
      return err(new RecoverableParserError("fail"));
    };

    const result = runParser(parser, "a");
    expect(unwrap(result)).toBe(42);
  });

  it("returns Left with error if parser fails", () => {
    const parser: Parser<number, Node> = () => {
      return err(new RecoverableParserError("parser failed"));
    };

    const result = runParser(parser, "a");
    expect(unwrapErr(result)).toBeInstanceOf(RecoverableParserError);
    expect(unwrapErr(result).message).toMatch(/parser failed/);
  });

  it("returns Left with error if parser does not consume all nodes", () => {
    const parser: Parser<number, Node> = (node) => {
      // Only consumes the first node, leaves the rest
      if (node) {
        return ok({ value: 1, start: node, next: node.next });
      }
      return err(new RecoverableParserError("no input"));
    };

    const result = runParser(parser, "a", "b");
    expect(unwrapErr(result)).toBeInstanceOf(RecoverableParserError);
    expect(unwrapErr(result).message).toMatch(/expected end of sequence/);
  });

  it("works with empty input", () => {
    const parser: Parser<string, Node> = (node) => {
      if (!node) {
        return ok({
          value: "empty",
          start: undefined,
          next: undefined,
        });
      }
      return err(new RecoverableParserError("not empty"));
    };

    const result = runParser(parser);
    expect(unwrap(result)).toBe("empty");
  });

  it("passes correct nodes to parser", () => {
    const parser: Parser<string, Node> = (node) => {
      if (node && node.value === "x" && node.next && node.next.value === "y") {
        return ok({ value: "ok", start: node, next: node.next.next });
      }
      return err(new RecoverableParserError("bad input"));
    };

    const result = runParser(parser, "x", "y");
    expect(unwrap(result)).toBe("ok");
  });
});
