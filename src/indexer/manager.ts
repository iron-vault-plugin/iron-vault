import { rootLogger } from "logger";
import {
  Component,
  EventRef,
  Events,
  TFile,
  type App,
  type CachedMetadata,
  type FileManager,
  type MetadataCache,
  type Vault,
} from "obsidian";
import { Indexer, IndexerId } from "./indexer";

const logger = rootLogger.getLogger("index-manager");

export class IndexManager extends Component {
  #events: Events = new Events();

  protected readonly metadataCache: MetadataCache;
  protected readonly vault: Vault;
  protected readonly fileManager: FileManager;
  protected readonly handlers: Map<IndexerId, Indexer> = new Map();
  protected readonly indexedFiles: Map<string, IndexerId> = new Map();

  constructor(app: App) {
    super();

    this.metadataCache = app.metadataCache;
    this.vault = app.vault;
    this.fileManager = app.fileManager;
  }

  public registerHandler(indexer: Indexer): void {
    if (this.handlers.has(indexer.id)) {
      throw new Error(`attempt to re-register handler for ${indexer.id}`);
    }
    logger.debug("registered indexer %s", indexer.id);
    this.handlers.set(indexer.id, indexer);
  }

  public onload(): void {
    logger.debug("[index-manager] Starting event listeners...");
    this.registerEvent(
      this.metadataCache.on("changed", (file, data, cache) => {
        this.indexFile(file, cache);
      }),
    );

    this.registerEvent(
      this.metadataCache.on("deleted", (file) => {
        this.unindex(file.path);
      }),
    );

    this.registerEvent(
      this.vault.on("rename", (file, oldPath) => {
        if (!(file instanceof TFile)) return;
        const indexer = this.currentIndexerForFile(oldPath);
        if (indexer != null) {
          this.indexedFiles.delete(oldPath);
          indexer.onRename(
            oldPath,
            file,
            this.metadataCache.getFileCache(file)!,
          );
          // if onRename fails, we won't re-add the file here.
          this.indexedFiles.set(file.path, indexer.id);
        }
      }),
    );
  }

  public indexAll(): void {
    logger.debug("[index-manager] Starting full index...");
    for (const file of this.vault.getMarkdownFiles()) {
      const cache = this.metadataCache.getFileCache(file);
      if (cache != null) {
        this.indexFile(file, cache);
      } else {
        logger.warn("no cache for %s", file.path);
      }
    }
    logger.debug("[index-manager] Full index complete.");
    this.trigger("initialized", {});
  }

  protected currentIndexerForFile(path: string): Indexer | undefined {
    const indexerId = this.indexedFiles.get(path);
    if (!indexerId) {
      return undefined;
    }
    const indexer = this.handlers.get(indexerId);
    if (!indexer) {
      throw new Error(`cannot find indexer ${indexerId} for file ${path}`);
    }
    return indexer;
  }

  protected getIndexer(indexerId: IndexerId): Indexer {
    const indexer = this.handlers.get(indexerId);
    if (!indexer) {
      throw new Error(`cannot find indexer ${indexerId}`);
    }
    return indexer;
  }

  private unindex(fileKey: string): void {
    const indexer = this.currentIndexerForFile(fileKey);
    if (indexer != null) {
      logger.debug(
        "[indexer:%s] [file: %s] removing indexed file for deleted file",
        indexer.id,
        fileKey,
      );
      const result = indexer.onDeleted(fileKey);
      if (result.type == "not_found") {
        logger.warn(
          "[indexer:%s] [file:%s] requested file not found in index",
          indexer.id,
          fileKey,
          result,
        );
      }
      this.indexedFiles.delete(fileKey);
    }
  }

  public findIndexerForFile(
    file: TFile,
    cache: CachedMetadata,
  ): Indexer | undefined {
    const kind = cache.frontmatter?.["iron-vault-kind"];
    if (kind) {
      const indexer = this.handlers.get(kind);
      if (indexer) {
        return indexer;
      } else {
        logger.warn('[file:%s] unknown iron-vault-kind "%s"', file.path, kind);
      }
    }
    return undefined;
  }

  public indexFile(file: TFile, cache: CachedMetadata): void {
    const indexKey = file.path;

    const priorIndexer = this.currentIndexerForFile(indexKey);
    const newIndexer = this.findIndexerForFile(file, cache);

    if (priorIndexer && priorIndexer != newIndexer) {
      // File has a new indexer (or no indexer) -- so unindex it from old indexer
      this.unindex(indexKey);
    }

    if (newIndexer) {
      logger.debug(
        "[indexer:%s] [file:%s] attempting to index",
        newIndexer.id,
        indexKey,
      );

      let result: ReturnType<Indexer["onChanged"]> | undefined = undefined;
      try {
        result = newIndexer.onChanged(file, cache);
      } catch (error) {
        // This was a truly exceptional error -- the indexer would not have recorded it, so we
        // do NOT want this to go down the 'indexed'/'error' path below, which marks this file
        // as having been indexed.
        logger.error(
          "[indexer:%s] [file:%s] unexpected error or result while indexing %o",
          newIndexer.id,
          indexKey,
          error,
        );
      }

      switch (result) {
        case "indexed": // Indexed as a success
        case "error": // Indexed as an error (this differs from the unexpected error above)
          logger.debug(
            "[indexer:%s] [file:%s] %s",
            newIndexer.id,
            indexKey,
            result == "error" ? "handled error" : "indexed",
          );
          this.indexedFiles.set(indexKey, newIndexer.id);
          break;
        case "wont_index":
          logger.debug(
            "[indexer:%s] [file:%s] not indexable",
            newIndexer.id,
            indexKey,
          );
          break;
        case undefined:
        // We don't do anything in this case.
      }
    }
  }

  on<K extends keyof EVENT_TYPES>(
    name: K,
    callback: (params: EVENT_TYPES[K]) => unknown,
    ctx?: unknown,
  ): EventRef {
    return this.#events.on(name, callback, ctx);
  }

  off(name: string, callback: (...data: never[]) => unknown): void {
    this.#events.off(name, callback);
  }

  offref(ref: EventRef): void {
    this.#events.offref(ref);
  }

  private trigger<K extends keyof EVENT_TYPES>(
    name: K,
    data: EVENT_TYPES[K],
  ): void {
    this.#events.trigger(name, data);
  }
}

export type EVENT_TYPES = {
  initialized: Record<string, never>;
};
