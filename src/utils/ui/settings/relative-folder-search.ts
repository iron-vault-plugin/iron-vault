import {
  App,
  SearchComponent,
  Setting,
  TAbstractFile,
  TFolder,
} from "obsidian";
import { joinPaths } from "utils/obsidian";
import { FolderTextSuggest } from "./folder";

export class RelativeFolderSearchComponent extends SearchComponent {
  suggest: FolderTextSuggest;

  #changeCallback?: (
    relativePath: string,
    absolutePath: string,
    folder: TAbstractFile | null,
  ) => unknown;

  static addToSetting(
    setting: Setting,
    app: App,
    callback: (
      select: RelativeFolderSearchComponent,
      setting: Setting,
    ) => unknown,
  ): Setting {
    const component = new RelativeFolderSearchComponent(setting.controlEl, app);
    setting.components.push(component);
    callback(component, setting);
    return setting;
  }

  constructor(
    containerEl: HTMLElement,
    readonly app: App,
  ) {
    super(containerEl);

    this.suggest = new FolderTextSuggest(app, this.inputEl);
    super.onChange(() => {
      this.onChanged();
    });
  }

  onChange(
    callback: (
      relativePath: string,
      absolutePath: string,
      folder: TAbstractFile | null,
    ) => unknown,
  ): this {
    this.#changeCallback = callback;
    return this;
  }

  onChanged(): void {
    const relPath = this.getValue();
    const absPath = joinPaths(this.suggest.baseFolder, relPath);
    if (this.#changeCallback)
      this.#changeCallback(
        relPath,
        absPath,
        this.app.vault.getAbstractFileByPath(absPath),
      );
  }

  setBaseFolder(folder: TFolder): this {
    this.suggest.setBaseFolder(folder);
    return this;
  }
}
