import { syntaxTree } from "@codemirror/language";
import { App } from "obsidian";
import { CharacterTracker } from "./character-tracker";
import { Datastore } from "./datastore";
import ForgedPlugin from "./index";
import { RollWrapper } from "./model/rolls";
import { ProgressIndex } from "./tracks/progress";

function stripLinks(input: string): string {
  return input.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
}

export class ForgedAPI {
  constructor(public readonly plugin: ForgedPlugin) {}

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

export const getAPI = (app?: App): ForgedAPI | undefined => {
  if (app) return app.plugins.plugins.forged?.api;
  else return window.ForgedAPI;
};

export const isPluginEnabled = (app: App) =>
  app.plugins.enabledPlugins.has("forged");
