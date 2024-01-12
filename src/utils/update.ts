import { App, TFile } from "obsidian";

export function updater<T>(
  fromData: (data: object) => T,
  toData: (obj: T) => object,
): (
  process: (processer: (data: any) => object) => Promise<void>,
  updater: (obj: T) => T,
) => Promise<T> {
  return async (process, updater) => {
    let updated: T | undefined;
    await process((data: any) => {
      updated = updater(fromData(Object.freeze(Object.assign({}, data))));
      return toData(updated);
    });
    // SAFETY: if we get here, we should have set updated.
    return updated!;
  };
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

export function vaultProcess(
  app: App,
  path: string,
): (processor: (data: any) => object) => Promise<void> {
  return async (processor) => {
    const file = app.vault.getAbstractFileByPath(path);
    if (!(file instanceof TFile)) {
      throw new Error(`invalid character file ${path}`);
    }
    await app.fileManager.processFrontMatter(file, (frontmatter: any) => {
      const updated = processor(frontmatter);
      // TODO: this isn't actually going to work right... for deletes
      Object.assign(frontmatter, updated);
    });
  };
}
