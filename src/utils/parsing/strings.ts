/**
 * Parsers for working with string nodes. (This is different than a character
 * parser)
 */
import { flatMap, Right } from "utils/either";
import {
  makeError,
  Parser,
  ParserErrors,
  RecoverableParserError,
} from "./parser";

/** Matches a string node against a regex. */

export function regex<E extends ParserErrors = ParserErrors>(
  pattern: RegExp,
): Parser<string[], string, E | RecoverableParserError> {
  return (node) => {
    return flatMap(str()(node), (result) => {
      const match = result.value.match(pattern);
      if (!match) {
        return makeError(
          node,
          `expected string to match regex ${pattern.toString()}, found "${result.value}"`,
        );
      }
      // console.log(`Matched regex ${pattern} on "${result.value}"`, match);
      return Right.create({
        value: [...match],
        start: result.start,
        next: result.next,
      });
    });
  };
} /** Matches a literal string (or if no string specified -- any string). */

export function str<E extends ParserErrors = ParserErrors>(): Parser<
  string,
  string,
  E | RecoverableParserError
>;
export function str<
  S1 extends string = string,
  E extends ParserErrors = ParserErrors,
>(str: S1): Parser<S1, string, E | RecoverableParserError>;
export function str<
  S1 extends string = string,
  S2 extends string = string,
  E extends ParserErrors = ParserErrors,
>(s1: S1, s2: S2): Parser<S1 | S2, string, E | RecoverableParserError>;
export function str<
  S1 extends string = string,
  S2 extends string = string,
  S3 extends string = string,
  E extends ParserErrors = ParserErrors,
>(
  s1: S1,
  s2: S2,
  s3: S3,
): Parser<S1 | S2 | S3, string, E | RecoverableParserError>;
export function str<
  S1 extends string = string,
  S2 extends string = string,
  S3 extends string = string,
  S4 extends string = string,
  E extends ParserErrors = ParserErrors,
>(
  s1: S1,
  s2: S2,
  s3: S3,
  s4: S4,
): Parser<S1 | S2 | S3 | S4, string, E | RecoverableParserError>;
export function str<S extends string, E extends ParserErrors = ParserErrors>(
  ...strs: S[]
): Parser<S, string, E | RecoverableParserError>;
export function str<E extends ParserErrors = ParserErrors>(
  ...strs: string[]
): Parser<string, string, E | RecoverableParserError> {
  return (node) => {
    if (node === undefined) {
      return makeError(node, `expected string, found end-of-sequence`);
    }
    if (typeof node.value !== "string") {
      return makeError(node, `expected string, found ${typeof node.value}`);
    }
    if (strs.length > 0 && !strs.includes(node.value)) {
      return makeError(
        node,
        `expected string ${strs.map((str) => `"${str}"`).join(", ")}; found "${node.value}"`,
      );
    }
    return Right.create({
      value: node.value,
      start: node,
      next: node.next,
    });
  };
}
