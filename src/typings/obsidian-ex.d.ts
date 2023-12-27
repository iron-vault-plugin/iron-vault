/* eslint-disable @typescript-eslint/method-signature-style */
import { ForgedAPI } from "api";
import "obsidian";

declare module "obsidian" {
  interface MetadataCache {
    on(name: "forged:index-changed", callback: () => any, ctx?: any): EventRef;
  }

  interface App {
    appId?: string;
    plugins: {
      enabledPlugins: Set<string>;
      plugins: {
        forged?: {
          api: ForgedAPI;
        };
      };
    };
  }
}

declare global {
  interface Window {
    ForgedAPI?: ForgedAPI;
  }
}
