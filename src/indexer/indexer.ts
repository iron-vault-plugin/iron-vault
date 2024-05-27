import { Index } from "indexer/index-impl";
import { type CachedMetadata } from "obsidian";
import { Either, Left } from "utils/either";

export type IndexErrorResult<E extends Error> = { type: "error"; error: E };
export type IndexUpdateResult<V, E extends Error> =
  | {
      type: "indexed";
      value: V;
    }
  | { type: "wont_index"; reason: string }
  | IndexErrorResult<E>;

export type IndexDeleteResult = { type: "not_found" } | { type: "removed" };

/** A WontIndexError is issued when the file should not be indexed, but it is not considered an error
 * with the file.
 */
export class WontIndexError extends Error {}

/** Unexpected indexing error is issued when an unhandled exception is raised while processing a file. */
export class UnexpectedIndexingError extends Error {}

export type IndexUpdate<T, E extends Error> = Either<
  WontIndexError | UnexpectedIndexingError | E,
  T
>;

export function wrapIndexUpdateError(
  error: unknown,
): Left<UnexpectedIndexingError> {
  return Left.create(
    new UnexpectedIndexingError(`encountered error while indexing: ${error}`, {
      cause: error,
    }),
  );
}

export interface Indexer {
  readonly id: IndexerId;
  onChanged(
    path: string,
    cache: CachedMetadata,
  ): IndexUpdateResult<unknown, Error>["type"];
  onDeleted(path: string): IndexDeleteResult;
  onRename(oldPath: string, newPath: string): void;
}

export type IndexerId = string;

export type IndexOf<Idx> =
  Idx extends BaseIndexer<infer T, infer E> ? Index<T, E> : never;

export abstract class BaseIndexer<T, E extends Error> implements Indexer {
  abstract id: string;
  public readonly index: Index<T, E> = new Index();

  constructor() {}

  onChanged(
    path: string,
    cache: CachedMetadata,
  ): IndexUpdateResult<unknown, Error>["type"] {
    let result: IndexUpdate<T, E>;
    try {
      result = this.processFile(path, cache);
    } catch (error) {
      result = wrapIndexUpdateError(error);
    }

    if (result.isRight()) {
      this.index.set(path, result);
      return "indexed";
    } else {
      if (result.error instanceof WontIndexError) {
        // "Won't index" is intended for a situation where this indexer decides it doesn't
        // apply to this file. We remove it from the index entirely.
        if (this.index.delete(path)) {
          console.log(
            "[indexer:%s] [file:%s] removing because no longer indexable",
            this.id,
            path,
          );
        }
        return "wont_index";
      } else {
        // Otherwise, when an error occurs while indexing a file, we consider that an
        // indication of fault in the file. We index it as an error and present that to the user.
        this.index.set(path, result as Left<E>);
        return "error";
      }
    }
  }

  onDeleted(path: string): IndexDeleteResult {
    if (this.index.delete(path)) {
      return { type: "removed" };
    } else {
      return {
        type: "not_found",
      };
    }
  }

  onRename(oldPath: string, newPath: string): void {
    const previous = this.index.get(oldPath);
    if (previous) {
      this.index.delete(oldPath);
      this.index.set(newPath, previous);
    }
  }

  abstract processFile(path: string, cache: CachedMetadata): IndexUpdate<T, E>;
}
