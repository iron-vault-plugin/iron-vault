import { type CachedMetadata } from "obsidian";

export type IndexUpdateErrorResult = { type: "error"; error: Error };
export type IndexUpdateResult =
  | {
      type: "indexed";
    }
  | { type: "removed" }
  | { type: "not_indexable" }
  | IndexUpdateErrorResult;

export function wrapIndexUpdateError(error: unknown): IndexUpdateErrorResult {
  return {
    type: "error",
    error:
      error instanceof Error
        ? error
        : new Error("indexing error", { cause: error }),
  };
}

export interface Indexer {
  readonly id: IndexerId;
  onChanged(path: string, cache: CachedMetadata): IndexUpdateResult;
  onDeleted(path: string): IndexUpdateResult;
  onRename(oldPath: string, newPath: string): void;
}

export type IndexerId = string;

export abstract class BaseIndexer<T> implements Indexer {
  abstract id: string;

  constructor(public readonly index: Map<string, T>) {}

  onChanged(path: string, cache: CachedMetadata): IndexUpdateResult {
    try {
      const entry = this.processFile(path, cache);
      if (entry) {
        this.index.set(path, entry);
        return { type: "indexed" };
      } else {
        if (this.index.delete(path)) {
          console.log(
            "[indexer:%s] [file:%s] removing because no longer indexable",
            this.id,
            path,
          );
        }
        return { type: "not_indexable" };
      }
    } catch (error) {
      if (this.index.delete(path)) {
        console.log(
          "[indexer:%s] [file:%s] removing because error",
          this.id,
          path,
        );
      }
      return wrapIndexUpdateError(error);
    }
  }

  onDeleted(path: string): IndexUpdateResult {
    if (this.index.delete(path)) {
      return { type: "removed" };
    } else {
      return {
        type: "error",
        error: new Error("delete requested on nonexistent entry"),
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

  abstract processFile(path: string, cache: CachedMetadata): T | undefined;
}
