import Result, * as result from "true-myth/result";
import { consumeAll } from "./sequences";

export class ParserError extends Error {}

export class RecoverableParserError extends ParserError {}

export class UnrecoverableParserError extends ParserError {}

export type ParserErrors = RecoverableParserError | UnrecoverableParserError;

export interface PNode<N, NV extends N = N> {
  readonly value: NV;
  readonly next: PNode<N> | undefined;
}

export interface ParseResult<V, N> {
  readonly value: V;
  readonly start: PNode<N> | undefined;
  readonly next: PNode<N> | undefined;
}

export type Parser<
  V,
  N,
  E extends ParserErrors = ParserErrors,
  PN extends PNode<N> | undefined = PNode<N> | undefined,
> = (node: PN) => Result<ParseResult<V, N>, E>;

export type AnyParser<V, N, E extends ParserErrors = ParserErrors> = <
  A extends N,
>(
  node: PNode<A> | undefined,
) => Result<ParseResult<V, A>, E>;

export type Definite<T> =
  T extends Parser<infer V, infer N, infer E, infer PN>
    ? Parser<V, N, E, NonNullable<PN>>
    : never;

/** Run a parser against a sequence of input nodes. */
export function runParser<V, N, E extends ParserErrors = ParserErrors>(
  parser: Parser<V, N, E>,
  ...nodes: N[]
): Result<V, E | RecoverableParserError> {
  return parser(LazyPNode.forSeq(...nodes)).andThen(({ value, next }) =>
    next ? makeError(next, "expected end of sequence") : result.ok(value),
  );
}

/** Run a parser against a sequence of input nodes, returning the result and the remaining nodes. */
export function runParserPartial<V, N, E extends ParserErrors = ParserErrors>(
  parser: Parser<V, N, E>,
  ...nodes: N[]
): Result<[V, N[]], E | RecoverableParserError> {
  return parser(LazyPNode.forSeq(...nodes)).map(({ value, next }) => [
    value,
    consumeAll(next).value.value,
  ]);
}

/** Creates an error with some extra context info. */
export function makeError(
  node: PNode<unknown, unknown> | undefined,
  message: string,
  options?: ErrorOptions,
): Result<never, RecoverableParserError> {
  return result.err(
    new RecoverableParserError(
      `${message}\n\nContext: ${JSON.stringify(node?.value)}`,
      options,
    ),
  );
}

/** A PNode for a sequence that defers creating the next node until needed. */
export class LazyPNode<N, NV extends N = N> implements PNode<N, NV> {
  #next: PNode<N> | undefined = undefined;
  #nextfn: undefined | (() => PNode<N> | undefined);
  value: NV;

  static forSeq<N>(...values: N[]): LazyPNode<N> | undefined {
    const buildNode = (index: number): LazyPNode<N> | undefined =>
      index < values.length
        ? new LazyPNode<N>(values[index], () => buildNode(index + 1))
        : undefined;

    return buildNode(0);
  }

  constructor(value: NV, nextfn: () => PNode<N> | undefined) {
    this.value = value;
    this.#nextfn = nextfn;
  }

  get next(): PNode<N> | undefined {
    if (this.#nextfn !== undefined) {
      this.#next = this.#nextfn();
      this.#nextfn = undefined; // Clear the function to avoid recomputation
    }
    return this.#next;
  }
}
