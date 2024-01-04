import {
  Component,
  TFile,
  type App,
  type CachedMetadata,
  type FileManager,
  type MetadataCache,
  type Vault,
} from "obsidian";
import { DataIndex } from "../datastore/data-index";
import { IndexUpdateResult, Indexer, IndexerId } from "./indexer";

// function isCharacterFile(
//   md: CachedMetadata,
// ): md is CachedMetadata & { frontmatter: FrontMatterCache } {
//   const tags = md != null ? getAllTags(md) ?? [] : [];
//   if (tags.contains("#character")) {
//     return true;
//   } else {
//     return false;
//   }
// }

export class IndexManager extends Component {
  protected metadataCache: MetadataCache;
  protected vault: Vault;
  protected fileManager: FileManager;
  protected handlers: Map<IndexerId, Indexer>;
  protected indexedFiles: Map<string, IndexerId>;

  constructor(
    app: App,
    protected readonly dataIndex: DataIndex,
  ) {
    super();

    this.metadataCache = app.metadataCache;
    this.vault = app.vault;
    this.handlers = new Map();
    this.fileManager = app.fileManager;
  }

  public registerHandler(indexer: Indexer): void {
    if (this.handlers.has(indexer.id)) {
      throw new Error(`attempt to re-register handler for ${indexer.id}`);
    }
    this.handlers.set(indexer.id, indexer);
  }

  public initialize(): void {
    this.registerEvent(
      this.metadataCache.on("changed", (file, data, cache) => {
        // console.log("changed: ", file);
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
        const indexer = this.currentIndexerForFile(file.path);
        if (indexer != null) {
          this.indexedFiles.delete(oldPath);
          indexer.onRename(oldPath, file.path);
          // if onRename fails, we won't re-add the file here.
          this.indexedFiles.set(file.path, indexer.id);
        }
      }),
    );

    for (const file of this.vault.getMarkdownFiles()) {
      const cache = this.metadataCache.getFileCache(file);
      if (cache != null) {
        this.indexFile(file, cache);
      } else {
        console.warn("no cache for ", file.path);
      }
    }
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
      console.log(
        "[indexer:%s] [file: %s] removing indexed file for deleted file",
        indexer.id,
        fileKey,
      );
      let result: IndexUpdateResult;
      try {
        result = indexer.onDeleted(fileKey);
      } catch (error) {
        result = { type: "error", error };
      }
      if (result.type != "removed") {
        console.warn(
          "[indexer:%s] [file:%s] unexpected result %o",
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
    // const tags = cache != null ? getAllTags(cache) ?? [] : [];
    // if (tags.contains("#character")) {
    //   return true;
    // } else {
    //   return false;
    // }
    const kind = cache.frontmatter?.forgedkind;
    if (kind) {
      const indexer = this.handlers.get(kind);
      if (indexer) {
        return indexer;
      } else {
        console.warn(
          '[indexer] [file:%s] unknown forgedkind "%s"',
          file.path,
          kind,
        );
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
      let result: IndexUpdateResult;
      try {
        result = newIndexer.onChanged(file.path, cache);
      } catch (error) {
        result = { type: "error", error };
      }
      switch (result.type) {
        case "indexed":
          console.log(
            "[indexer:%s] [file:%s] indexed",
            newIndexer.id,
            indexKey,
          );
          this.indexedFiles.set(indexKey, newIndexer.id);
          break;
        case "not_indexable":
          console.log(
            "[indexer:%s] [file:%s] not indexable",
            newIndexer.id,
            indexKey,
          );
          break;
        case "error":
        default:
          console.error(
            "[indexer:%s] [file:%s] unexpected error or result while indexing %o",
            newIndexer.id,
            indexKey,
            result,
          );
      }
    }
  }
}
