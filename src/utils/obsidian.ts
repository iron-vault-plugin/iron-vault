import { rootLogger } from "logger";
import {
  App,
  TFile,
  TFolder,
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
