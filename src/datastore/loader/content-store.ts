/**
 * The ContentStore is reponsible for managing content items.
 */
import { childOfPath, findTopLevelParentPath } from "utils/paths";

import { rootLogger } from "logger";

const logger = rootLogger.getLogger("content-store");

export interface IContentManager<Content extends { path: string }> {
  onUpdateRoot(
    callback: (root: string, content: Content[] | null) => unknown,
  ): void;
  addRoot(path: string): void;
  removeRoot(path: string): void;
  getContent(path: string): Content | undefined;
  addContent(content: Content): void;
  deleteContent(path: string): boolean;
  renameContent(oldPath: string, newPath: string): boolean;
  getRoots(): ReadonlySet<string>;
  valuesUnderPath(path: string): Iterable<Content>;
}

export class MetarootContentManager<Content extends { path: string }>
  implements IContentManager<Content>
{
  private metaRoot: string | null = null;

  constructor(private readonly delegate: IContentManager<Content>) {}

  onUpdateRoot(
    callback: (root: string, content: Content[] | null) => unknown,
  ): void {
    this.delegate.onUpdateRoot(callback);
  }

  /** Tests if a given path is in the meta root. */
  isInMetaRoot(path: string): boolean {
    return this.metaRoot ? childOfPath(this.metaRoot, path) : false;
  }

  setMetaRoot(path: string | null): void {
    if (this.metaRoot && this.metaRoot != path) {
      // The old metaroot is no longer valid. Remove all roots that came from it.
      logger.debug(
        "[content-manager] Meta root changed from %s to %s. Clearing old roots.",
        this.metaRoot,
        path,
      );
      for (const root of this.delegate.getRoots()) {
        if (childOfPath(this.metaRoot, root)) {
          logger.debug(
            "[content-manager] Removing root %s due to meta root change.",
            root,
          );
          this.delegate.removeRoot(root);
        }
      }
    } else if (this.metaRoot === path) {
      logger.debug(
        "[content-manager] Meta root is already %s. Ignoring.",
        path,
      );
      return;
    }

    this.metaRoot = path;

    if (this.metaRoot) {
      logger.debug(
        "[content-manager] Meta root set to %s. Updating roots.",
        this.metaRoot,
      );
      for (const { path: contentPath } of this.delegate.valuesUnderPath(
        this.metaRoot,
      )) {
        const metaParent = findTopLevelParentPath(this.metaRoot, contentPath);
        if (metaParent) this.delegate.addRoot(metaParent);
      }
    }
  }

  addRoot(path: string): void {
    if (this.metaRoot && childOfPath(this.metaRoot, path)) {
      logger.debug(
        "[content-manager] Ignoring addRoot %s because it is within the meta root %s.",
        path,
        this.metaRoot,
      );
      return; // Ignore roots outside the meta root
    }
    this.delegate.addRoot(path);
  }

  removeRoot(path: string): void {
    if (this.metaRoot && childOfPath(this.metaRoot, path)) {
      logger.debug(
        "[content-manager] Ignoring removeRoot %s because it is within the meta root %s.",
        path,
        this.metaRoot,
      );
      return; // Ignore roots outside the meta root
    }
    this.delegate.removeRoot(path);
  }

  getContent(path: string): Content | undefined {
    return this.delegate.getContent(path);
  }

  addContent(content: Content): void {
    // We need to check if this represents a new root under the metaroot
    const topLevel = this.metaRoot
      ? findTopLevelParentPath(this.metaRoot, content.path)
      : undefined;
    if (topLevel) {
      this.delegate.addRoot(topLevel);
    }
    return this.delegate.addContent(content);
  }

  deleteContent(path: string): boolean {
    return this.delegate.deleteContent(path);
  }

  renameContent(oldPath: string, newPath: string): boolean {
    const topLevelOld = this.metaRoot
      ? findTopLevelParentPath(this.metaRoot, oldPath)
      : undefined;
    const topLevelNew = this.metaRoot
      ? findTopLevelParentPath(this.metaRoot, newPath)
      : undefined;

    let changed = false;
    if (topLevelOld === oldPath) {
      // If the old path is a top-level root, we need to remove it
      this.delegate.removeRoot(topLevelOld);
      changed = true;
    }

    if (topLevelNew === newPath) {
      // If the new path is a top-level root, we need to add it
      this.delegate.addRoot(topLevelNew);
      changed = true;
    }

    if (this.delegate.renameContent(oldPath, newPath)) {
      changed = true;
    }

    return changed;
  }
  getRoots(): ReadonlySet<string> {
    return this.delegate.getRoots();
  }
  valuesUnderPath(path: string): Iterable<Content> {
    return this.delegate.valuesUnderPath(path);
  }
}

export class ContentManagerImpl<Content extends { path: string }>
  implements IContentManager<Content>
{
  private contentIndex: Map<string, Content>;
  private roots: Set<string> = new Set();
  private updateRootCallback: (
    root: string,
    content: Content[] | null,
  ) => unknown = () => {};

  constructor() {
    this.contentIndex = new Map();
  }

  onUpdateRoot(
    callback: (root: string, content: Content[] | null) => unknown,
  ): void {
    this.updateRootCallback = callback;
  }

  getRoots(): ReadonlySet<string> {
    return this.roots;
  }

  addRoot(path: string): void {
    const existingRoot = this.rootForPath(path);
    if (existingRoot === path) {
      return; // Already registered as a root
    } else if (existingRoot) {
      logger.error(
        "[content-manager] Path %s is already under root %s.",
        path,
        existingRoot,
      );
      throw new Error(
        `Path ${path} is already under root ${existingRoot}. Cannot register as a new root.`,
      ); // Cannot register a new root under an existing one
    }

    this.roots.add(path);

    this.#updateRoot(path);
  }

  #updateRoot(root: string): void {
    const content = [...this.valuesUnderPath(root)];
    logger.debug(
      "[content-manager] Updating root %s with %d content items.",
      root,
      content.length,
    );
    this.updateRootCallback(root, content);
  }

  #updateRootForPath(path: string): void {
    const root = this.rootForPath(path);
    if (root) {
      logger.debug(
        "[content-manager] Updating root for path %s under root %s.",
        path,
        root,
      );
      this.#updateRoot(root);
    } else {
      logger.debug(
        "[content-manager] No root found for path %s. Cannot update.",
        path,
      );
    }
  }

  removeRoot(path: string): void {
    if (this.roots.delete(path)) {
      this.updateRootCallback(path, null);
    }
  }

  getContent(path: string): Content | undefined {
    return this.contentIndex.get(path);
  }

  addContent(content: Content): void {
    this.contentIndex.set(content.path, content);
    this.#updateRootForPath(content.path);
  }

  deleteContent(path: string): boolean {
    if (this.contentIndex.delete(path)) {
      this.#updateRootForPath(path);
      return true;
    }
    return false;
  }

  renameContent(oldPath: string, newPath: string): boolean {
    const content = this.contentIndex.get(oldPath);
    if (content) {
      logger.debug(
        "[content-manager] Renaming content from %s to %s",
        oldPath,
        newPath,
      );
      content.path = newPath;
      this.contentIndex.delete(oldPath);
      this.contentIndex.set(newPath, content);
      const oldRoot = this.rootForPath(oldPath);
      const newRoot = this.rootForPath(newPath);
      if (oldRoot) {
        this.#updateRoot(oldRoot);
      }
      // If the new path is under a different root, we need to update that root as well.
      if (newRoot && newRoot !== oldRoot) {
        this.#updateRoot(newRoot);
      }
      return true;
    }
    return false;
  }

  *valuesUnderPath(path: string): Generator<Content> {
    for (const [key, content] of this.contentIndex.entries()) {
      if (key == path || childOfPath(path, key)) {
        yield content;
      }
    }
  }

  rootForPath(path: string): string | undefined {
    for (const root of this.roots) {
      if (root == path || childOfPath(root, path)) {
        return root;
      }
    }
    return undefined;
  }
}
