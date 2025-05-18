import { findTopLevelParent } from "@ironvault/utils/paths";
import { rootLogger } from "logger";
import {
  App,
  TAbstractFile,
  TFile,
  TFolder,
  WorkspaceLeaf,
  normalizePath,
  stringifyYaml,
  type Plugin,
} from "obsidian";
import { IronVaultKind, PLUGIN_KIND_FIELD } from "../constants";

const logger = rootLogger.getLogger("utils");

export function pluginAsset(plug: Plugin, assetPath: string): string {
  return normalizePath(
    [plug.app.vault.configDir, "plugins", plug.manifest.id, assetPath].join(
      "/",
    ),
  );
}
// export function updater<T>(
//   factory: (data: object) => T,
//   data: (obj: T) => Record<string, unknown>,
//   updater: (obj: T) => T,
// ): (app: App, path: string) => Promise<T> {
//   return async (app, path) => {
//     const file = app.vault.getAbstractFileByPath(path);
//     if (!(file instanceof TFile)) {
//       throw new Error(`invalid character file ${path}`);
//     }
//     let updated: T | undefined;
//     await app.fileManager.processFrontMatter(file, (frontmatter: any) => {
//       updated = updater(factory(Object.freeze(Object.assign({}, frontmatter))));
//       // TODO: this isn't actually going to work right... for deletes
//       Object.assign(frontmatter, data(updated));
//     });
//     // SAFETY: if we get here, we should have set updated.
//     return updated!;
//   };
// }

export type ObjectProcessor = (
  processor: (data: Record<string, unknown>) => Record<string, unknown>,
) => Promise<void>;

export function vaultProcess(
  app: App,
  path: string,
  processDeletes: boolean = true,
): ObjectProcessor {
  return async (processor) => {
    const file = app.vault.getAbstractFileByPath(path);
    if (!(file instanceof TFile)) {
      throw new Error(`invalid character file ${path}`);
    }
    await app.fileManager.processFrontMatter(
      file,
      (frontmatter: Record<string, unknown>) => {
        const originalKeys = Object.keys(frontmatter);
        const updated = processor(frontmatter);
        if (frontmatter === updated) return;

        if (processDeletes) {
          for (const originalKey of originalKeys) {
            if (!(originalKey in updated)) {
              delete frontmatter[originalKey];
            }
          }
        }
        Object.assign(frontmatter, updated);
      },
    );
  };
}

export async function getExistingOrNewFolder(
  app: App,
  path: string,
): Promise<TFolder> {
  const normalizedPath = normalizePath(path);
  const existingFolder = app.vault.getFolderByPath(normalizedPath);
  if (existingFolder) return existingFolder;

  return await app.vault.createFolder(normalizedPath);
}

export async function createNewIronVaultEntityFile(
  app: App,
  targetFolderPath: string,
  fileName: string,
  ironVaultKind: IronVaultKind,
  frontMatter: Record<string, unknown>,
  templatePath?: string,
  defaultTemplate?: string,
  setFocus: boolean = false,
): Promise<TFile> {
  const targetFolder = await getExistingOrNewFolder(app, targetFolderPath);

  const file = await app.fileManager.createNewMarkdownFile(
    targetFolder,
    fileName,
    `---\n${stringifyYaml({ ...frontMatter, [PLUGIN_KIND_FIELD]: ironVaultKind })}\n---\n\n`,
  );

  let shouldSetFocus = setFocus;
  const enableTemplaterPlugin = false;
  const templaterPlugin =
    enableTemplaterPlugin &&
    app.plugins.enabledPlugins.has("templater-obsidian")
      ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (app.plugins.plugins as Record<string, any>)["templater-obsidian"]
      : undefined;
  const templateFile = templatePath && app.vault.getFileByPath(templatePath);
  if (shouldSetFocus && templaterPlugin && templateFile) {
    // If we have a template and the templater plugin, use that.
    // This only works if we set focus, so also require that.
    await app.workspace.getLeaf().openFile(file, {
      active: true,
      state: { mode: "source" },
      eState: { rename: "all" },
    });
    shouldSetFocus = false;

    await templaterPlugin.templater.append_template_to_active_file(
      templateFile,
    );
  } else if (templateFile) {
    if (enableTemplaterPlugin && !shouldSetFocus) {
      logger.warn(
        "Can only use templater plugin when setting focus. Falling back on ordinary template mode...",
      );
    }
    // If we have a template file, but no plugin-- just append the file contents.
    const templateContents = await app.vault.cachedRead(templateFile);
    await app.vault.append(file, "\n" + templateContents);
  } else if (defaultTemplate) {
    // Otherwise, just add the default template
    await app.vault.append(file, defaultTemplate);
  }

  if (shouldSetFocus) {
    await app.workspace.getLeaf().openFile(file, {
      active: true,
      state: { mode: "source" },
      eState: { rename: "all" },
    });
  }

  return file;
}

/** Gets the path of `file` relative to `baseFolder`.
 *
 * Raises an error if `baseFolder` is not a parent of `file`.
 */
export function getRelativePath(
  baseFolder: TFolder,
  file: TAbstractFile,
): string {
  if (baseFolder.isRoot()) return file.path;
  if (baseFolder == file) return "";

  const prefix = baseFolder.path + "/";
  if (file.path.startsWith(prefix)) {
    return file.path.slice(prefix.length);
  } else {
    throw new Error(`'${file.path}' is not in '${baseFolder.path}'`);
  }
}

/** Concatenates path segments onto a folder and normalizes the path. */
export function joinPaths(folder: TFolder, ...segments: string[]): string {
  return normalizePath(
    (folder.isRoot() ? "" : folder.path + "/") + segments.join("/"),
  );
}

/** Reveal a singleton view, creating it if it doesn't exist. */
export async function showSingletonView<T extends Record<string, unknown>>(
  app: App,
  viewType: string,
  state?: T,
): Promise<void> {
  const { workspace } = app;

  let leaf: WorkspaceLeaf | null = null;
  const leaves = workspace.getLeavesOfType(viewType);

  if (leaves.length > 0) {
    // A leaf with our view already exists, use that
    leaf = leaves[0];
  } else {
    // Our view could not be found in the workspace, create a new leaf
    // in the main split
    leaf = workspace.getLeaf(true);
    await leaf.setViewState({ type: viewType, active: true, state });
  }

  // "Reveal" the leaf in case it is in a collapsed sidebar
  workspace.revealLeaf(leaf);
}

export function findTopLevelParentFolder(
  rootFolder: TFolder,
  childPath: TAbstractFile,
): TAbstractFile | undefined {
  const topLevelChild = findTopLevelParent(rootFolder.path, childPath.path);
  if (!topLevelChild) {
    return undefined;
  }
  return rootFolder.children.find((child) => child.name === topLevelChild);
}
