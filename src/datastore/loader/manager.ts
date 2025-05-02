/**
 * Manages loading of homebrew content via a web worker.
 *
 * This class is responsible for coordinating the loading of homebrew content.
 * It utilizes a web worker to perform the loading process in a separate thread.
 *
 * */

import { Datasworn, DataswornSource } from "@datasworn/core";
import newDataLoaderWorker, {
  DataLoaderWorker,
} from "datastore/loader/data-loader.worker";
import Emittery, { UnsubscribeFunction } from "emittery";
import IronVaultPlugin from "index";
import { rootLogger } from "logger";
import { CachedMetadata, Component, TFile, TFolder, Vault } from "obsidian";
import { Either } from "utils/either";
import { atOrChildOfPath } from "utils/paths";
import { FileProblem } from "./builder";
import { IndexResult } from "./messages";

const logger = rootLogger.getLogger("datastore.loader.manager");

export type DATA_MANAGER_EVENT_TYPES = {
  "updated:package": {
    root: string;
    rulesPackage: Datasworn.RulesPackage | null;
    files: ReadonlyMap<
      string,
      Either<FileProblem, DataswornSource.RulesPackage>
    >;
  };
};

export class DataManager extends Component {
  private worker!: DataLoaderWorker;
  private homebrewRoot: string | null = null;
  private monitoredPaths: Set<string> = new Set();
  private packages: Map<
    string,
    {
      package: Datasworn.RulesPackage | null;
      files: Map<string, Either<FileProblem, DataswornSource.RulesPackage>>;
    }
  > = new Map();

  #emitter = new Emittery<DATA_MANAGER_EVENT_TYPES>();

  constructor(private plugin: IronVaultPlugin) {
    super();
  }

  getPackageForPath(path: string):
    | {
        root: string;
        package: Datasworn.RulesPackage | null;
        files: Map<string, Either<FileProblem, DataswornSource.RulesPackage>>;
      }
    | undefined {
    for (const [
      packageRoot,
      { package: packageData, files },
    ] of this.packages.entries()) {
      if (atOrChildOfPath(packageRoot, path)) {
        return { root: packageRoot, package: packageData, files };
      }
    }
    return undefined;
  }

  getStatusForPath(
    path: string,
  ): Either<FileProblem, DataswornSource.RulesPackage> | undefined {
    for (const [packageRoot, { files }] of this.packages.entries()) {
      if (atOrChildOfPath(packageRoot, path)) {
        return files.get(path);
      }
    }
    return undefined;
  }

  async reindexAll(): Promise<void> {
    logger.info("Reindexing all content...");
    this.#restartWorker();
    if (this.homebrewRoot) {
      await this.setHomebrewRoot(this.homebrewRoot);
    }
    for (const root of this.monitoredPaths) {
      await this.addCampaignContentRoot(root);
    }
  }

  #restartWorker(): void {
    if (this.worker) {
      this.worker.terminate();
    }
    this.worker = newDataLoaderWorker();
    this.worker.onmessage = (event: MessageEvent<IndexResult>) => {
      const result = event.data;
      // console.log("Data loaded:", result);
      if (result.type === "updated:package") {
        this.packages.set(result.root, {
          package: result.package,
          files: result.files,
        });
        this.#emitter.emit("updated:package", {
          root: result.root,
          rulesPackage: result.package,
          files: result.files,
        });
      }
    };
  }

  onload(): void {
    this.#restartWorker();

    this.registerEvent(
      this.plugin.app.vault.on("modify", async (file) => {
        if (file instanceof TFile && file.extension !== "md") {
          // We catch markdown files after the metadata cache is updated. For everything
          // else, we have to do it separately, here.
          if (
            this.homebrewRoot &&
            atOrChildOfPath(this.homebrewRoot, file.path)
          ) {
            // If the file is in the homebrew root, we should index it directly
            this.indexFile(file, await this.plugin.app.vault.read(file), null);
          } else {
            for (const monitoredPath of this.monitoredPaths) {
              if (atOrChildOfPath(monitoredPath, file.path)) {
                this.indexFile(
                  file,
                  await this.plugin.app.vault.read(file),
                  null,
                );
              }
            }
          }
        }
      }),
    );
    this.registerEvent(
      this.plugin.app.metadataCache.on("changed", async (file, data, cache) => {
        if (
          this.homebrewRoot &&
          atOrChildOfPath(this.homebrewRoot, file.path)
        ) {
          // If the file is in the homebrew root, we should index it directly
          this.indexFile(file, data, cache);
        } else {
          for (const monitoredPath of this.monitoredPaths) {
            if (atOrChildOfPath(monitoredPath, file.path)) {
              this.indexFile(file, data, cache);
            }
          }
        }
      }),
    );
    this.registerEvent(
      this.plugin.app.metadataCache.on("deleted", async (file) => {
        if (
          this.homebrewRoot &&
          atOrChildOfPath(this.homebrewRoot, file.path)
        ) {
          this.delete(file.path);
        } else {
          for (const monitoredPath of this.monitoredPaths) {
            if (atOrChildOfPath(monitoredPath, file.path)) {
              this.delete(file.path);
            }
          }
        }
      }),
    );
    this.registerEvent(
      this.plugin.app.vault.on("rename", async (file, oldPath) => {
        if (
          this.homebrewRoot &&
          (atOrChildOfPath(this.homebrewRoot, oldPath) ||
            atOrChildOfPath(this.homebrewRoot, file.path))
        ) {
          this.rename(oldPath, file.path);
        } else {
          for (const monitoredPath of this.monitoredPaths) {
            if (monitoredPath === oldPath) {
              this.removeCampaignContentRoot(oldPath);
              // We don't reindex when adding the root, because all of the content
              // will eventually be renamed.
              this.addCampaignContentRoot(file.path, false);
              this.rename(oldPath, file.path);
            } else if (
              atOrChildOfPath(monitoredPath, oldPath) ||
              atOrChildOfPath(monitoredPath, file.path)
            ) {
              this.rename(oldPath, file.path);
            }
          }
        }
      }),
    );
  }

  async setHomebrewRoot(
    root: string | null,
    reindex: boolean = true,
  ): Promise<void> {
    this.homebrewRoot = root;
    // No harm in resending to the worker, and we use this for restarts
    this.worker.postMessage({
      type: "setMetaRoot",
      root,
    });
    if (reindex && root) {
      await this.#indexFolder(root);
    }
  }

  async addCampaignContentRoot(
    root: string,
    reindex: boolean = true,
  ): Promise<void> {
    this.monitoredPaths.add(root);
    // No harm in resending to the worker, and we use this for restarts
    this.worker.postMessage({
      type: "addRoot",
      root,
    });
    if (reindex) await this.#indexFolder(root);
  }

  async #indexFolder(root: string): Promise<void> {
    if (root.startsWith("@")) return; // Skip special roots like "@datasworn"

    // Walk the root folder and index all files in it
    const folder = this.plugin.app.vault.getAbstractFileByPath(root);
    if (folder && folder instanceof TFolder) {
      const promises: Promise<void>[] = [];
      const indexFile = async (file: TFile) => {
        promises.push(
          this.plugin.app.vault.cachedRead(file).then((content) => {
            this.indexFile(
              file,
              content,
              this.plugin.app.metadataCache.getFileCache(file),
            );
          }),
        );
      };

      Vault.recurseChildren(folder, (fileOrFolder) => {
        if (fileOrFolder instanceof TFile) {
          indexFile(fileOrFolder);
        }
      });

      // Wait for all indexing to complete
      await Promise.all(promises);

      logger.info(`Indexed all files in ${root}`);
    }
  }

  removeCampaignContentRoot(root: string): void {
    if (this.monitoredPaths.has(root)) {
      this.worker.postMessage({
        type: "removeRoot",
        root,
      });
      this.monitoredPaths.delete(root);
    }
  }

  async index(file: TFile): Promise<void> {
    // Send a message to the worker with the file to be indexed
    this.indexFile(
      file,
      await this.plugin.app.vault.cachedRead(file),
      this.plugin.app.metadataCache.getFileCache(file),
    );
  }

  protected indexFile(
    file: TFile,
    content: string,
    cache: CachedMetadata | null,
  ): void {
    this.indexDirect({
      path: file.path,
      mtime: file.stat.mtime,
      content,
      frontmatter: cache?.frontmatter,
    });
  }

  /** Add content to index directly. */
  indexDirect({
    path,
    mtime,
    content,
    frontmatter,
  }: {
    path: string;
    mtime: number;
    content: string;
    frontmatter: Record<string, unknown> | undefined;
  }) {
    this.worker.postMessage({
      type: "index",
      path,
      mtime,
      content,
      frontmatter,
    });
  }

  debug(): void {
    this.worker.postMessage({
      type: "debug",
    });
  }

  delete(path: string): void {
    this.worker.postMessage({
      type: "delete",
      path,
    });
  }

  rename(oldPath: string, newPath: string): void {
    this.worker.postMessage({
      type: "rename",
      oldPath,
      newPath,
    });
  }

  onunload(): void {
    if (this.worker) {
      this.worker.terminate();
    }
  }

  on<K extends keyof DATA_MANAGER_EVENT_TYPES>(
    event: K,
    listener: (params: DATA_MANAGER_EVENT_TYPES[K]) => void,
  ): UnsubscribeFunction {
    return this.#emitter.on(event, listener);
  }
}
