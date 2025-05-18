/** Parser combinators related to branching logic. */

import Result, { err, ok } from "true-myth/result";
import {
  makeError,
  Parser,
  ParserErrors,
  PNode,
  RecoverableParserError,
  UnrecoverableParserError,
} from "./parser";

/** Generate array with integers between `from` and `to` (exclusive of to). */
function numberRangeExclusive(from: number, to: number): number[] {
  if (from > to) {
    throw new Error(
      `Invalid range: from (${from}) cannot be greater than to (${to})`,
    );
  }
  return Array(to - from)
    .fill(0)
    .map((_, i) => from + i);
}

/** Convert a recoverable parser error to an unrecoverable one */
export function cut<V, N, E extends ParserErrors = ParserErrors>(
  parser: Parser<V, N, E>,
): Parser<V, N, E | UnrecoverableParserError> {
  return (node) => {
    const result = parser(node);
    if (result.isErr && result.error instanceof RecoverableParserError) {
      return err(
        new UnrecoverableParserError(
          `Unrecoverable error: ${result.error.message}`,
          { cause: result.error },
        ),
      );
    }
    return result;
  };
}

/** Make a parser optional. */
export function optional<V, N, E extends ParserErrors = ParserErrors>(
  parser: Parser<V, N, E>,
): Parser<V | undefined, N, E & UnrecoverableParserError> {
  return (node) => {
    const result = parser(node);
    if (result.isErr && result.error instanceof RecoverableParserError) {
      return ok({
        value: undefined,
        start: node,
        next: node,
      });
    }
    return result;
  };
}

// let _debug = false;
export function debug<V, N, E extends ParserErrors = ParserErrors>(
  parser: Parser<V, N, E>,
): Parser<V, N, E> {
  return (node) => {
    console.log("Debugging parser at node:", JSON.stringify(node?.value));
    const result = parser(node);
    if (result.isErr) {
      console.log("Parser failed with error:", result.error);
    } else {
      console.log(
        "Parser succeeded with value:",
        JSON.stringify(result.value.value),
      );
    }
    return result;
  };
}

/** Apply a set of parsers, taking the first that succeeds. */
export function alt<A1, N, E extends ParserErrors = ParserErrors>(
  p1: Parser<A1, N, E>,
): Parser<A1, N, E | RecoverableParserError>;
export function alt<A1, A2, N, E extends ParserErrors = ParserErrors>(
  p1: Parser<A1, N, E>,
  p2: Parser<A2, N, E>,
): Parser<A1 | A2, N, E | RecoverableParserError>;
export function alt<A1, A2, A3, N, E extends ParserErrors = ParserErrors>(
  p1: Parser<A1, N, E>,
  p2: Parser<A2, N, E>,
  p3: Parser<A3, N, E>,
): Parser<A1 | A2 | A3, N, E | RecoverableParserError>;
export function alt<A1, A2, A3, A4, N, E extends ParserErrors = ParserErrors>(
  p1: Parser<A1, N, E>,
  p2: Parser<A2, N, E>,
  p3: Parser<A3, N, E>,
  p4: Parser<A4, N, E>,
): Parser<A1 | A2 | A3 | A4, N, E | RecoverableParserError>;
export function alt<
  A1,
  A2,
  A3,
  A4,
  A5,
  N,
  E extends ParserErrors = ParserErrors,
>(
  p1: Parser<A1, N, E>,
  p2: Parser<A2, N, E>,
  p3: Parser<A3, N, E>,
  p4: Parser<A4, N, E>,
  p5: Parser<A5, N, E>,
): Parser<A1 | A2 | A3 | A4 | A5, N, E | RecoverableParserError>;
export function alt<E extends ParserErrors = ParserErrors>(
  ...parsers: Parser<unknown, unknown, E>[]
): Parser<unknown, unknown, E | RecoverableParserError> {
  return (node) => {
    const errors: E[] = [];
    for (const parser of parsers) {
      const result = parser(node);
      if (result.isOk) {
        return result;
      }
      if (result.error instanceof UnrecoverableParserError) {
        return result;
      }
      errors.push(result.error);
    }
    return err(
      new RecoverableParserError(
        `No parsers succeeded in alternative. Last failed with: ${errors[errors.length - 1].message}`,
        { cause: errors[errors.length - 1] },
      ),
    );
  };
}

/** Tries parsers in different orders until all parsers succeed. */
export function permutationOptional<
  P1,
  N,
  E extends ParserErrors = ParserErrors,
>(p1: Parser<P1, N, E>): Parser<[P1], N, E | RecoverableParserError>;
export function permutationOptional<
  P1,
  P2,
  N,
  E extends ParserErrors = ParserErrors,
>(
  p1: Parser<P1, N, E>,
  p2: Parser<P2, N, E>,
): Parser<[P1, P2], N, E | RecoverableParserError>;
export function permutationOptional<
  P1,
  P2,
  P3,
  N,
  E extends ParserErrors = ParserErrors,
>(
  p1: Parser<P1, N, E>,
  p2: Parser<P2, N, E>,
  p3: Parser<P3, N, E>,
): Parser<[P1, P2, P3], N, E | RecoverableParserError>;
export function permutationOptional<
  P1,
  P2,
  P3,
  P4,
  N,
  E extends ParserErrors = ParserErrors,
>(
  p1: Parser<P1, N, E>,
  p2: Parser<P2, N, E>,
  p3: Parser<P3, N, E>,
  p4: Parser<P4, N, E>,
): Parser<[P1, P2, P3, P4], N, E | RecoverableParserError>;
export function permutationOptional<
  P,
  N,
  E extends ParserErrors = ParserErrors,
>(...parsers: Parser<P, N, E>[]): Parser<P[], N, E | RecoverableParserError>;
export function permutationOptional<N, E extends ParserErrors = ParserErrors>(
  ...parsers: Parser<unknown, N, E>[]
): Parser<unknown[], N, E | RecoverableParserError> {
  return (node) => {
    function tryParsers(
      /** Indices of unused parsers. */
      remaining: Set<number>,
      nextNode: typeof node,
    ): Result<
      { value: unknown[]; next: PNode<N> | undefined },
      E | RecoverableParserError
    > {
      for (const unusedIndex of remaining) {
        const parser = parsers[unusedIndex];
        const result = parser(nextNode);
        if (result.isErr) {
          if (result.error instanceof UnrecoverableParserError) {
            return result.cast(); // Stop on unrecoverable error
          }
          continue; // Try the next parser
        }

        // If we successfully parsed, we can continue with the next parsers
        const newRemaining = new Set(remaining.values());
        newRemaining.delete(unusedIndex);

        const remainingResults = tryParsers(newRemaining, result.value.next);
        if (remainingResults.isOk) {
          // Since we have succeeded, we can fill in the result at the unused index.
          remainingResults.value.value[unusedIndex] = result.value.value;
          return remainingResults;
        }

        // We weren't able to parse with the remaining parsers, so we need to continue
        // with the next unused parser.
      }

      // If we reach here, all parsers have been attempted.
      return ok({
        value: Array(parsers.length).fill(undefined),
        next: nextNode,
      });
    }

    return tryParsers(
      new Set(numberRangeExclusive(0, parsers.length)),
      node,
    ).map(({ value, next }) => ({
      value,
      start: node,
      next,
    }));
  };
}

/** Tries parsers in different orders until all parsers succeed. */
export function permutation<P1, N, E extends ParserErrors = ParserErrors>(
  p1: Parser<P1, N, E>,
): Parser<[P1], N, E | RecoverableParserError>;
export function permutation<P1, P2, N, E extends ParserErrors = ParserErrors>(
  p1: Parser<P1, N, E>,
  p2: Parser<P2, N, E>,
): Parser<[P1, P2], N, E | RecoverableParserError>;
export function permutation<
  P1,
  P2,
  P3,
  N,
  E extends ParserErrors = ParserErrors,
>(
  p1: Parser<P1, N, E>,
  p2: Parser<P2, N, E>,
  p3: Parser<P3, N, E>,
): Parser<[P1, P2, P3], N, E | RecoverableParserError>;
export function permutation<
  P1,
  P2,
  P3,
  P4,
  N,
  E extends ParserErrors = ParserErrors,
>(
  p1: Parser<P1, N, E>,
  p2: Parser<P2, N, E>,
  p3: Parser<P3, N, E>,
  p4: Parser<P4, N, E>,
): Parser<[P1, P2, P3, P4], N, E | RecoverableParserError>;
export function permutation<P, N, E extends ParserErrors = ParserErrors>(
  ...parsers: Parser<P, N, E>[]
): Parser<P[], N, E | RecoverableParserError>;
export function permutation<N, E extends ParserErrors = ParserErrors>(
  ...parsers: Parser<unknown, N, E>[]
): Parser<unknown[], N, E | RecoverableParserError> {
  return (node) => {
    function tryParsers(
      /** Indices of unused parsers. */
      remaining: Set<number>,
      nextNode: typeof node,
    ): Result<
      { value: unknown[]; next: PNode<N> | undefined },
      E | RecoverableParserError
    > {
      if (remaining.size === 0) {
        // All parsers have been used successfully. Allocate the result array.
        return ok({
          value: Array(parsers.length),
          next: nextNode,
        });
      }

      for (const unusedIndex of remaining) {
        const parser = parsers[unusedIndex];
        const result = parser(nextNode);
        if (result.isErr) {
          if (result.error instanceof UnrecoverableParserError) {
            return result.cast(); // Stop on unrecoverable error
          }
          continue; // Try the next parser
        }

        // If we successfully parsed, we can continue with the next parsers
        const newRemaining = new Set(remaining.values());
        newRemaining.delete(unusedIndex);

        const remainingResults = tryParsers(newRemaining, result.value.next);
        if (remainingResults.isOk) {
          // Since we have succeeded, we can fill in the result at the unused index.
          remainingResults.value.value[unusedIndex] = result.value.value;
          return remainingResults;
        }

        // We weren't able to parse with the remaining parsers, so we need to continue
        // with the next unused parser.
      }

      // If we reach here, it means no parsers succeeded.
      return makeError(nextNode, `No parsers succeeded in permutation`);
    }

    return tryParsers(
      new Set(numberRangeExclusive(0, parsers.length)),
      node,
    ).map(({ value, next }) => ({
      value,
      start: node,
      next,
    }));
  };
}
