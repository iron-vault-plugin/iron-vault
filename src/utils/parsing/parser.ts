import { Either, Left } from "utils/either";

export class ParserError extends Error {}

export class RecoverableParserError extends ParserError {}

export class UnrecoverableParserError extends ParserError {}

export type ParserErrors = RecoverableParserError | UnrecoverableParserError;

export type PNode<N, NV extends N = N> = {
  value: NV;
  next: PNode<N> | undefined;
};

export type ParseResult<V, N> = {
  value: V;
  start: PNode<N> | undefined;
  next: PNode<N> | undefined;
};

export type Parser<V, N, E extends ParserErrors = ParserErrors> = (
  node: PNode<N> | undefined,
) => Either<E, ParseResult<V, N>>;

/** Run a parser against a sequence of input nodes. */
export function runParser<V, N, E extends ParserErrors = ParserErrors>(
  parser: Parser<V, N, E>,
  ...nodes: N[]
): Either<E, V> {
  return parser(LazyPNode.forSeq(...nodes)).map(({ value }) => value);
}

/** Creates an error with some extra context info. */
export function makeError(
  node: PNode<unknown, unknown> | undefined,
  message: string,
  options?: ErrorOptions,
): Left<RecoverableParserError> {
  return Left.create(
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
