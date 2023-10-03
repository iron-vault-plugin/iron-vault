/* eslint-disable @typescript-eslint/method-signature-style */
import "obsidian";

declare module "obsidian" {
  interface MetadataCache {
    on(name: "forged:index-changed", callback: () => any, ctx?: any): EventRef;
  }
}
