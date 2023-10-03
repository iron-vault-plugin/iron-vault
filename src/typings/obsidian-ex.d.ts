/* eslint-disable @typescript-eslint/method-signature-style */
import { type CharacterTracker } from "character-tracker";
import { type Datastore } from "datastore";
import "obsidian";

declare module "obsidian" {
  interface MetadataCache {
    on(name: "forged:index-changed", callback: () => any, ctx?: any): EventRef;
  }
}

declare global {
  interface Window {
    ForgedAPI?: {
      datastore: Datastore;
      tracker: CharacterTracker;
    };
  }
}
