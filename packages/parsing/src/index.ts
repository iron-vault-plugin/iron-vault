export * from "./branching";
export * from "./parser";
export * from "./sequences";

export function lazy<V, N, E extends ParserErrors = ParserErrors>(
  parser: () => Parser<V, N, E>,
): Parser<V, N, E> {
  return (node) => {
    return parser()(node);
  };
}

export function one<N, E extends ParserErrors = ParserErrors>(): Parser<
  N,
  N,
  E | RecoverableParserError
> {
  return (node) => {
    if (node === undefined) {
      return err(
        new RecoverableParserError("expected a node, found end of sequence"),
      );
    }
    return ok({
      value: node.value,
      start: node,
      next: node.next,
    });
  };
}

export * from "./strings";

import Result, { err, ok } from "true-myth/result";
import {
  Definite,
  LazyPNode,
  makeError,
  Parser,
  ParserErrors,
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
  parser: (node: Np) => Result<V, E>,
  label?: string,
): Parser<V, N, E | RecoverableParserError | UnrecoverableParserError> {
  const liftedTest = liftTest(test);
  return (node) => {
    if (node === undefined) {
      return err(
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
      if (result.isErr && result.error instanceof RecoverableParserError) {
        return err(
          new UnrecoverableParserError(
            `Error parsing ${label ?? "node"}: ${result.error.message}`,
            { cause: result.error },
          ),
        );
      }
      return result;
    } else {
      return err(
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
  parser: (node: Np) => Result<V, E>,
): Parser<V | undefined, N, E | UnrecoverableParserError> {
  const liftedTest = liftTest(test);
  return (node) => {
    if (node && liftedTest(node)) {
      const result = parser(node.value).map((value) => ({
        value,
        start: node,
        next: node.next,
      }));
      if (result.isErr && result.error instanceof RecoverableParserError) {
        return err(
          new UnrecoverableParserError(result.error.message, {
            cause: result.error,
          }),
        );
      }
      return result;
    }
    // We didn't match the node, so we return an empty result and keep the pointer at the current
    // node.
    return ok({
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
    if (result.isErr) {
      return result.cast();
    }
    const { value, start, next } = result.value;
    try {
      const newValue = fn(value);
      return ok({
        value: newValue,
        start,
        next,
      });
    } catch (error) {
      return makeError(node, `Error applying function: ${error}`, {
        cause: error,
      });
    }
  };
}

export function applyFlat<V, U, N, E extends ParserErrors = ParserErrors>(
  parser: Parser<V, N, E>,
  fn: (value: V) => Result<U, E>,
): Parser<U, N, E | RecoverableParserError> {
  return (node) => {
    const result = parser(node);
    if (result.isErr) {
      return result.cast();
    }
    const { value, start, next } = result.value;
    try {
      return fn(value).map((newValue) => ({
        value: newValue,
        start,
        next,
      }));
    } catch (error) {
      return makeError(node, `Error applying function: ${error}`, {
        cause: error,
      });
    }
  };
}

export function succ<V, N, E extends ParserErrors = ParserErrors>(
  value: V,
): Parser<V, N, E> {
  return (node) => {
    return ok({
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
    return parser(node).andThen((result) => {
      if (!checkFn(result.value)) {
        return err(
          new RecoverableParserError(
            typeof message == "string"
              ? `${message}: ${JSON.stringify(result.value)}`
              : message(result.value),
          ),
        );
      }
      return ok(result);
    });
  };
}

export function pipe<V1, V2, N, E extends ParserErrors>(
  p1: Parser<V1, N, E>,
  p2: Definite<Parser<V2, V1, E>>,
): Parser<V2, N, E>;
export function pipe<V1, V2, V3, N, E extends ParserErrors>(
  p1: Parser<V1, N, E>,
  p2: Definite<Parser<V2, V1, E>>,
  p3: Definite<Parser<V3, V2, E>>,
): Parser<V3, N, E>;
export function pipe<V, N, E extends ParserErrors = ParserErrors>(
  p1: Parser<V, N, E>,
  ...ps: Definite<Parser<V, V, E>>[]
): Parser<V, N, E>;
export function pipe<V, N, E extends ParserErrors = ParserErrors>(
  p1: Parser<V, N, E>,
  ...ps: Definite<Parser<V, V, E>>[]
): Parser<V, N, E> {
  return (start) => {
    const initial = p1(start);
    if (initial.isErr) {
      return initial;
    }
    let node: PNode<V> = {
      value: initial.value.value,
      next: undefined,
    };
    for (const p of ps) {
      const result = p(node);
      if (result.isErr) {
        return result.cast();
      }
      node = { value: result.value.value, next: result.value.next };
    }
    return ok({
      value: node!.value,
      start: start,
      next: initial.value.next,
    });
  };
}

/**  */

/** Consume any single node. */
export function some<N, E extends ParserErrors = ParserErrors>(): Parser<
  N,
  N,
  E | RecoverableParserError
> {
  return (node) => {
    if (node === undefined) {
      return makeError(node, "expected a node, found end-of-sequence");
    }
    return ok({
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

    return parser(LazyPNode.forSeq(...node.value)).andThen((res) => {
      if (res.next !== undefined) {
        return makeError(
          node,
          `extra children found, starting at ${JSON.stringify(res.next.value)}`,
        );
      }
      return ok({
        value: res.value,
        start: node,
        next: node.next,
      });
    });
  };
}

export function consumed<V, N, E extends ParserErrors = ParserErrors>(
  parser: Parser<V, N, E>,
): Parser<[N[], V], N, E> {
  return (node) => {
    return parser(node).map((result) => {
      return {
        // TODO: this should actually return all the nodes that were consumed from the input
        // from the start node to the next node.
        value: [[node!.value], result.value],
        start: result.start,
        next: result.next,
      };
    });
  };
}

export function recognize<V, N, E extends ParserErrors = ParserErrors>(
  parser: Parser<V, N, E>,
): Parser<N[], N, E> {
  return (node) => {
    return parser(node).map((result) => {
      return {
        // TODO: this should actually return all the nodes that were consumed from the input
        // from the start node to the next node.
        value: [node!.value],
        start: result.start,
        next: result.next,
      };
    });
  };
}
