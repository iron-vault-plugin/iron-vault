import { Result } from "true-myth";
import { err, Ok, ok } from "true-myth/result";
import { apply } from ".";
import {
  Parser,
  ParserError,
  ParserErrors,
  ParseResult,
  PNode,
  RecoverableParserError,
  UnrecoverableParserError,
} from "./parser";

export function seq<V1, N, E extends ParserError>(
  p1: Parser<V1, N, E>,
): Parser<[V1], N, E>;
export function seq<V1, V2, N, E extends ParserError>(
  p1: Parser<V1, N, E>,
  p2: Parser<V2, N, E>,
): Parser<[V1, V2], N, E>;
export function seq<V1, V2, V3, N, E extends ParserError>(
  p1: Parser<V1, N, E>,
  p2: Parser<V2, N, E>,
  p3: Parser<V3, N, E>,
): Parser<[V1, V2, V3], N, E>;
export function seq<V1, V2, V3, V4, N, E extends ParserError>(
  p1: Parser<V1, N, E>,
  p2: Parser<V2, N, E>,
  p3: Parser<V3, N, E>,
  p4: Parser<V4, N, E>,
): Parser<[V1, V2, V3, V4], N, E>;
export function seq<V1, V2, V3, V4, V5, N, E extends ParserError>(
  p1: Parser<V1, N, E>,
  p2: Parser<V2, N, E>,
  p3: Parser<V3, N, E>,
  p4: Parser<V4, N, E>,
  p5: Parser<V5, N, E>,
): Parser<[V1, V2, V3, V4, V5], N, E>;
export function seq<V1, V2, V3, V4, V5, V6, N, E extends ParserError>(
  p1: Parser<V1, N, E>,
  p2: Parser<V2, N, E>,
  p3: Parser<V3, N, E>,
  p4: Parser<V4, N, E>,
  p5: Parser<V5, N, E>,
  p6: Parser<V6, N, E>,
): Parser<[V1, V2, V3, V4, V5, V6], N, E>;
export function seq<V, N, E extends ParserError>(
  ...parsers: Parser<V, N, E>[]
): Parser<V[], N, E>;
export function seq<N, E extends ParserError>(
  ...parsers: Parser<unknown, N, E>[]
): Parser<unknown[], N, E> {
  return (
    start: PNode<N> | undefined,
  ): Result<ParseResult<unknown[], N>, E> => {
    const results: unknown[] = [];
    let next: PNode<N, N> | undefined = start;
    for (const parser of parsers) {
      const result = parser(next);
      if (result.isErr) {
        return result.cast();
      }
      const { value, next: newNext } = result.value;
      results.push(value);
      next = newNext;
    }
    return ok({
      value: results,
      start,
      next,
    });
  };
} /** Runs two parsers sequentially, discarding the value of the first. */

export function preceded<V1, V2, N, E extends ParserErrors = ParserErrors>(
  p1: Parser<V1, N, E>,
  p2: Parser<V2, N, E>,
): Parser<V2, N, E | RecoverableParserError> {
  return apply(seq(p1, p2), ([, v2]) => v2);
} /** Repeats the given parser at least min and up to max times. If min or max is undefined,
 * it means no limit in that direction.
 */

export function repeat<V, N, E extends ParserErrors = ParserErrors>(
  min: number | undefined,
  max: number | undefined,
  parser: Parser<V, N, E>,
): Parser<V[], N, E | RecoverableParserError> {
  return (node) => {
    const results: V[] = [];
    let currentNode: PNode<N> | undefined = node;

    min ??= 0;
    max ??= Number.MAX_SAFE_INTEGER;

    while (currentNode !== undefined && results.length < max) {
      const result = parser(currentNode);
      if (result.isErr) {
        if (result.error instanceof UnrecoverableParserError) {
          return result.cast();
        }

        break;
      }
      results.push(result.value.value);
      currentNode = result.value.next;
    }

    if (results.length < min) {
      return err(
        new RecoverableParserError(
          `expected at least ${min} matches, found ${results.length}`,
        ),
      );
    }

    return ok({
      value: results,
      start: node,
      next: currentNode,
    });
  };
}

function cleanOk<V, E = never>(result: V): Ok<V, E> {
  return ok<V, E>(result) as Ok<V, E>;
}

/** Slurps all remaining nodes into a list. */
export function consumeAll<N>(
  node: PNode<N> | undefined,
): Ok<ParseResult<N[], N>, never> {
  const result: N[] = [];
  let currentNode = node;
  while (currentNode !== undefined) {
    result.push(currentNode.value);
    currentNode = currentNode.next;
  }
  return cleanOk({
    value: result,
    next: undefined,
    start: node,
  });
}
