import { App, TFile, normalizePath, type Plugin } from "obsidian";

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
