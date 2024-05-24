/* eslint-disable @typescript-eslint/method-signature-style */
import { IronVaultAPI } from "api";
import "obsidian";

declare module "obsidian" {
  export interface SuggestModal<T> {
    chooser: Chooser<T>;
    suggestEl: HTMLDivElement;
  }

  export interface Chooser<T> {
    setSelectedItem(selectedIdx: number, scroll?: boolean): void;
    useSelectedItem(evt: MouseEvent | KeyboardEvent): void;
    values: { [x: string]: { item: T } };
    selectedItem: number;
    chooser: Chooser<T>;
    setSuggestions(items: T[]): void;
    containerEl: HTMLElement;
    addMessage(message: string): void;
    updateSuggestions(): void;
    suggestions: { scrollIntoViewIfNeeded: () => void }[];
  }
}

declare module "obsidian" {
  interface MetadataCache {
    on(
      name: "iron-vault:index-changed",
      callback: () => unknown,
      ctx?: unknown,
    ): EventRef;
  }

  interface App {
    appId?: string;
    plugins: {
      enabledPlugins: Set<string>;
      plugins: {
        ["iron-vault"]?: {
          api: IronVaultAPI;
        };
      };
    };
  }
}

declare global {
  interface Window {
    IronVaultAPI?: IronVaultAPI;
  }
}
