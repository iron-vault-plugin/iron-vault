import { EmittingIndex, ReadonlyIndex } from "indexer/index-interface";
import { rootLogger } from "logger";
import { Logger } from "loglevel";
import { TFile, type CachedMetadata } from "obsidian";
import { Either, Left } from "utils/either";
import { IronVaultKind } from "../constants";
import { IndexImpl } from "./index-impl";

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

export type CachedMetadataWithFrontMatter = CachedMetadata & {
  frontmatter: NonNullable<CachedMetadata["frontmatter"]>;
};

export function assertHasFrontmatter(
  cache: CachedMetadata,
): asserts cache is CachedMetadataWithFrontMatter {
  if (cache.frontmatter == null) {
    throw new Error("Cache is missing frontmatter, how can that be?");
  }
}

export interface Indexer {
  readonly id: IronVaultKind;
  onChanged(
    file: TFile,
    cache: CachedMetadataWithFrontMatter,
  ): IndexUpdateResult<unknown, Error>["type"];
  onDeleted(path: string): IndexDeleteResult;
  onRename(
    oldPath: string,
    newFile: TFile,
    cache: CachedMetadataWithFrontMatter,
  ): void;
}

export type IndexerId = string;

export type IndexOf<Idx> =
  Idx extends BaseIndexer<infer T, infer E> ? ReadonlyIndex<T, E> : never;

export abstract class BaseIndexer<T, E extends Error> implements Indexer {
  abstract readonly id: IronVaultKind;
  public readonly index: EmittingIndex<T, E> = new IndexImpl();

  #_logger?: Logger;

  constructor() {}

  get #logger(): Logger {
    // NOTE: this is because the id field isn't available in the constructor :grimace:
    if (!this.#_logger) {
      this.#_logger = rootLogger.getLogger(`indexer.${this.id}`);
    }
    return this.#_logger;
  }

  onChanged(
    file: TFile,
    cache: CachedMetadataWithFrontMatter,
  ): IndexUpdateResult<unknown, Error>["type"] {
    let result: IndexUpdate<T, E>;
    try {
      result = this.processFile(file, cache);
    } catch (error) {
      result = wrapIndexUpdateError(error);
    }

    if (result.isRight()) {
      this.index.set(file.path, result);
      return "indexed";
    } else {
      if (result.error instanceof WontIndexError) {
        // "Won't index" is intended for a situation where this indexer decides it doesn't
        // apply to this file. We remove it from the index entirely.
        if (this.index.delete(file.path)) {
          this.#logger.debug(
            "[indexer:%s] [file:%s] removing because no longer indexable",
            this.id,
            file.path,
          );
        }
        return "wont_index";
      } else {
        // Otherwise, when an error occurs while indexing a file, we consider that an
        // indication of fault in the file. We index it as an error and present that to the user.
        this.#logger.error(
          "[indexer:%s] [file:%s] error while processing file",
          this.id,
          file.path,
          result.error,
        );
        this.index.set(file.path, result as Left<E>);
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

  onRename(
    oldPath: string,
    newFile: TFile,
    cache: CachedMetadataWithFrontMatter,
  ): void {
    if (this.index.rename(oldPath, newFile.path)) {
      if (this.reprocessRenamedFiles) {
        // TODO: this is all hacky, and also what do I do if this returns something unexpected?
        this.onChanged(newFile, cache);
      }
    } else {
      this.#logger.warn(
        "Missing expected key '%s' in rename operation",
        oldPath,
      );
    }
  }

  /** This defines how your indexer processes the files into its indexed type. */
  abstract processFile(
    file: TFile,
    cache: CachedMetadataWithFrontMatter,
  ): IndexUpdate<T, E>;

  /** Defines whether renamed files should be reindexed (e.g., if they include their path) */
  protected readonly reprocessRenamedFiles: boolean = false;
}
