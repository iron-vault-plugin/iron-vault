export * from "./branching";
export * from "./parser";
export * from "./sequences";
export * from "./strings";

import { Either, flatMap, Left, Right } from "utils/either";
import {
  LazyPNode,
  makeError,
  Parser,
  ParserErrors,
  ParseResult,
  PNode,
  RecoverableParserError,
  UnrecoverableParserError,
} from "./parser";

export function liftTest<N, Np extends N>(
  test: (node: N) => node is Np,
): (node: PNode<N>) => node is PNode<Np> {
  return (node: PNode<N>): node is PNode<Np> => {
    return test(node.value);
  };
}

export function match<
  V,
  N,
  Np extends N,
  E extends ParserErrors = ParserErrors,
>(
  test: (node: N) => node is Np,
  parser: (node: Np) => Either<E, V>,
  label?: string,
): Parser<V, N, E | RecoverableParserError | UnrecoverableParserError> {
  const liftedTest = liftTest(test);
  return (node) => {
    if (node === undefined) {
      return Left.create(
        new RecoverableParserError(
          `expected ${label ?? "node"}, found end-of-sequence`,
        ),
      );
    }
    if (liftedTest(node)) {
      const result = parser(node.value).map((value) => ({
        value,
        start: node,
        next: node.next,
      }));
      if (result.isLeft() && result.error instanceof RecoverableParserError) {
        return Left.create(
          new UnrecoverableParserError(
            `Error parsing ${label ?? "node"}: ${result.error.message}`,
            { cause: result.error },
          ),
        );
      }
      return result;
    } else {
      return Left.create(
        new RecoverableParserError(
          `node did not match expected type: ${label}`,
        ),
      );
    }
  };
}

export function matchOpt<
  V,
  N,
  Np extends N,
  E extends ParserErrors = ParserErrors,
>(
  test: (node: N) => node is Np,
  parser: (node: Np) => Either<E, V>,
): Parser<V | undefined, N, E | UnrecoverableParserError> {
  const liftedTest = liftTest(test);
  return (node) => {
    if (node && liftedTest(node)) {
      const result = parser(node.value).map((value) => ({
        value,
        start: node,
        next: node.next,
      }));
      if (result.isLeft() && result.error instanceof RecoverableParserError) {
        return Left.create(
          new UnrecoverableParserError(result.error.message, {
            cause: result.error,
          }),
        );
      }
      return result;
    }
    // We didn't match the node, so we return an empty result and keep the pointer at the current
    // node.
    return Right.create({
      value: undefined,
      start: node,
      next: node,
    });
  };
}

export function apply<V, U, N, E extends ParserErrors = ParserErrors>(
  parser: Parser<V, N, E>,
  fn: (value: V) => U,
): Parser<U, N, E | RecoverableParserError> {
  return (node) => {
    const result = parser(node);
    if (result.isLeft()) {
      return result;
    }
    const { value, start, next } = result.value;
    try {
      const newValue = fn(value);
      return Right.create({
        value: newValue,
        start,
        next,
      });
    } catch (error) {
      return Left.create(
        new RecoverableParserError(`Error applying function: ${error}`, {
          cause: error,
        }),
      );
    }
  };
}

export function succ<V, N, E extends ParserErrors = ParserErrors>(
  value: V,
): Parser<V, N, E> {
  return (node: PNode<N> | undefined): Either<E, ParseResult<V, N>> => {
    return Right.create({
      value,
      start: node,
      next: node,
    });
  };
}

export function fail<V, N, E extends ParserErrors = ParserErrors>(
  error: string,
): Parser<V, N, E | RecoverableParserError> {
  return (node) => {
    return makeError(node, error);
  };
}

/** Validate that the parsed result matches the given condition. */
export function check<V, N, E extends ParserErrors = ParserErrors>(
  parser: Parser<V, N, E>,
  checkFn: (value: V) => boolean,
  message: string | ((value: V) => string) = "Value did not pass check",
): Parser<V, N, E | RecoverableParserError> {
  return (node) => {
    return flatMap(parser(node), (result) => {
      if (!checkFn(result.value)) {
        return Left.create(
          new RecoverableParserError(
            typeof message == "string"
              ? `${message}: ${JSON.stringify(result.value)}`
              : message(result.value),
          ),
        );
      }
      return Right.create(result);
    });
  };
}

export function pipe<V1, V2, N, E extends ParserErrors>(
  p1: Parser<V1, N, E>,
  p2: Parser<V2, V1, E>,
): Parser<V2, N, E>;
export function pipe<V1, V2, V3, N, E extends ParserErrors>(
  p1: Parser<V1, N, E>,
  p2: Parser<V2, V1, E>,
  p3: Parser<V3, V2, E>,
): Parser<V3, N, E>;
export function pipe<E extends ParserErrors = ParserErrors>(
  ...ps: Parser<unknown, unknown, E>[]
): Parser<unknown, unknown, E> {
  return (node) => {
    for (const p of ps) {
      const result = p(node);
      if (result.isLeft()) {
        return result;
      }
      node = { value: result.value.value, next: result.value.next };
    }
    return Right.create({
      value: node!.value,
      start: node,
      next: node!.next,
    });
  };
}

export function some<N, E extends ParserErrors = ParserErrors>(): Parser<
  N,
  N,
  E | RecoverableParserError
> {
  return (node) => {
    if (node === undefined) {
      return makeError(node, "expected a node, found end-of-sequence");
    }
    return Right.create({
      value: node.value,
      start: node,
      next: node.next,
    });
  };
}

/** Converts a parser for a stream of nodes to a parser for a single list node. */
export function liftAsList<V, N, E extends ParserErrors = ParserErrors>(
  parser: Parser<V, N, E>,
): Parser<V, N[], E | RecoverableParserError> {
  return (node) => {
    if (node === undefined || !Array.isArray(node.value)) {
      return makeError(node, `expected an array of nodes`);
    }

    return flatMap(parser(LazyPNode.forSeq(...node.value)), (res) => {
      if (res.next !== undefined) {
        return makeError(
          node,
          `extra children found, starting at ${JSON.stringify(res.next.value)}`,
        );
      }
      return Right.create({
        value: res.value,
        start: node,
        next: node.next,
      });
    });
  };
}
