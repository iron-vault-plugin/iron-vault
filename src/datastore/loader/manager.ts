/**
 * Manages loading of homebrew content via a web worker.
 *
 * This class is responsible for coordinating the loading of homebrew content.
 * It utilizes a web worker to perform the loading process in a separate thread.
 *
 * */

import newDataLoaderWorker, {
  DataLoaderWorker,
} from "datastore/loader/data-loader.worker";
import IronVaultPlugin from "index";
import { rootLogger } from "logger";
import { CachedMetadata, Component, TFile, TFolder, Vault } from "obsidian";
import { childOfPath } from "utils/paths";
import { IndexResult } from "./messages";

const logger = rootLogger.getLogger("datastore.loader.manager");

export class DataManager extends Component {
  private worker!: DataLoaderWorker;
  private homebrewRoot: string | null = null;
  private monitoredPaths: Set<string> = new Set();

  constructor(private plugin: IronVaultPlugin) {
    super();
  }

  onload(): void {
    if (this.worker) {
      this.worker.terminate();
    }
    this.worker = newDataLoaderWorker();
    this.worker.onmessage = (event: MessageEvent<IndexResult>) => {
      const result = event.data;
      // Handle the result from the worker
      console.log("Data loaded:", result);
      // You can add further processing of the result here
    };

    this.registerEvent(
      this.plugin.app.metadataCache.on("changed", async (file, data, cache) => {
        if (this.homebrewRoot && childOfPath(this.homebrewRoot, file.path)) {
          // If the file is in the homebrew root, we should index it directly
          this.indexDirect(file, data, cache);
        } else {
          for (const monitoredPath of this.monitoredPaths) {
            if (childOfPath(monitoredPath, file.path)) {
              this.indexDirect(file, data, cache);
            }
          }
        }
      }),
    );
    this.registerEvent(
      this.plugin.app.metadataCache.on("deleted", async (file) => {
        for (const monitoredPath of this.monitoredPaths) {
          if (childOfPath(monitoredPath, file.path)) {
            this.delete(file.path);
          }
        }
      }),
    );
    this.registerEvent(
      this.plugin.app.vault.on("rename", async (file, oldPath) => {
        for (const monitoredPath of this.monitoredPaths) {
          if (monitoredPath === oldPath) {
            this.removeCampaignContentRoot(oldPath);
            // We don't reindex when adding the root, because all of the content
            // will eventually be renamed.
            this.addCampaignContentRoot(file.path, false);
          } else if (childOfPath(monitoredPath, oldPath)) {
            this.rename(oldPath, file.path);
          }
        }
      }),
    );
  }

  setHomebrewRoot(root: string, reindex: boolean = true): void {
    if (this.homebrewRoot === root) {
      return;
    }
    this.homebrewRoot = root;
    this.worker.postMessage({
      type: "setMetaRoot",
      root,
    });
    if (reindex) {
      this.#indexFolder(root);
    }
  }

  addCampaignContentRoot(root: string, reindex: boolean = true): void {
    // TODO: maybe I should just send all the roots and let the worker diff the list?
    if (this.monitoredPaths.has(root)) {
      return;
    }
    this.monitoredPaths.add(root);
    this.worker.postMessage({
      type: "addRoot",
      root,
    });
    if (reindex) this.#indexFolder(root);
  }
  #indexFolder(root: string): void {
    // Walk the root folder and index all files in it
    const folder = this.plugin.app.vault.getAbstractFileByPath(root);
    if (folder && folder instanceof TFolder) {
      const promises: Promise<void>[] = [];
      const indexFile = async (file: TFile) => {
        promises.push(
          this.plugin.app.vault.cachedRead(file).then((content) => {
            this.indexDirect(
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
      Promise.all(promises).then(() => {
        logger.info(`Indexed all files in ${root}`);
      });
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
    this.indexDirect(
      file,
      await this.plugin.app.vault.cachedRead(file),
      this.plugin.app.metadataCache.getFileCache(file),
    );
  }

  indexDirect(
    file: TFile,
    content: string,
    cache: CachedMetadata | null,
  ): void {
    // Send a message to the worker with the file to be indexed
    this.worker.postMessage({
      type: "index",
      path: file.path,
      mtime: file.stat.mtime,
      content,
      frontmatter: cache?.frontmatter,
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
}
