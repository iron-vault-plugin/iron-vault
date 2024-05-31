import { syntaxTree } from "@codemirror/language";
import { App } from "obsidian";
import { ProgressIndex } from "tracks/indexer";
import { CharacterTracker } from "./character-tracker";
import { Datastore } from "./datastore";
import IronVaultPlugin from "./index";
import { RollWrapper } from "./model/rolls";

function stripLinks(input: string): string {
  return input.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
}

export class IronVaultAPI {
  constructor(public readonly plugin: IronVaultPlugin) {}

  get datastore(): Datastore {
    return this.plugin.datastore;
  }

  get tracker(): CharacterTracker {
    return this.plugin.characters;
  }

  get progress(): ProgressIndex {
    return this.plugin.progressIndex;
  }

  public roll(oracle: string): RollWrapper {
    return this.datastore.roller.roll(oracle);
  }

  public stripLinks(input: string): string {
    return stripLinks(input);
  }

  public getSyntaxTree() {
    const state = this.plugin.app.workspace.activeEditor?.editor?.cm.state;
    return state && syntaxTree(state);
  }
}

export const getAPI = (app?: App): IronVaultAPI | undefined => {
  if (app) return app.plugins.plugins["iron-vault"]?.api;
  else return window.IronVaultAPI;
};

export const isPluginEnabled = (app: App) =>
  app.plugins.enabledPlugins.has("iron-vault");
