import { Left, Right } from "utils/either";
import { Parser, RecoverableParserError, runParser } from "./parser";

describe("runParser", () => {
  type Node = string;

  it("returns Right with value when parser succeeds and consumes all nodes", () => {
    const parser: Parser<number, Node> = (node) => {
      if (node && node.value === "a" && !node.next) {
        return Right.create({ value: 42, start: node, next: undefined });
      }
      return Left.create(new RecoverableParserError("fail"));
    };

    const result = runParser(parser, "a");
    expect(result.unwrap()).toBe(42);
  });

  it("returns Left with error if parser fails", () => {
    const parser: Parser<number, Node> = () => {
      return Left.create(new RecoverableParserError("parser failed"));
    };

    const result = runParser(parser, "a");
    expect(result.unwrapError()).toBeInstanceOf(RecoverableParserError);
    expect(result.unwrapError().message).toMatch(/parser failed/);
  });

  it("returns Left with error if parser does not consume all nodes", () => {
    const parser: Parser<number, Node> = (node) => {
      // Only consumes the first node, leaves the rest
      if (node) {
        return Right.create({ value: 1, start: node, next: node.next });
      }
      return Left.create(new RecoverableParserError("no input"));
    };

    const result = runParser(parser, "a", "b");
    expect(result.unwrapError()).toBeInstanceOf(RecoverableParserError);
    expect(result.unwrapError().message).toMatch(/expected end of sequence/);
  });

  it("works with empty input", () => {
    const parser: Parser<string, Node> = (node) => {
      if (!node) {
        return Right.create({
          value: "empty",
          start: undefined,
          next: undefined,
        });
      }
      return Left.create(new RecoverableParserError("not empty"));
    };

    const result = runParser(parser);
    expect(result.unwrap()).toBe("empty");
  });

  it("passes correct nodes to parser", () => {
    const parser: Parser<string, Node> = (node) => {
      if (node && node.value === "x" && node.next && node.next.value === "y") {
        return Right.create({ value: "ok", start: node, next: node.next.next });
      }
      return Left.create(new RecoverableParserError("bad input"));
    };

    const result = runParser(parser, "x", "y");
    expect(result.unwrap()).toBe("ok");
  });
});
