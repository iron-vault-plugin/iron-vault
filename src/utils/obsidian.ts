import { normalizePath, type Plugin } from "obsidian";

export function pluginAsset(plug: Plugin, assetPath: string): string {
  return normalizePath(
    [plug.app.vault.configDir, "plugins", plug.manifest.id, assetPath].join(
      "/",
    ),
  );
}
