import { AbstractInputSuggest, App, TFolder } from "obsidian";

export class FolderTextSuggest extends AbstractInputSuggest<TFolder> {
  constructor(
    app: App,
    readonly textInputEl: HTMLInputElement | HTMLDivElement,
  ) {
    super(app, textInputEl);
  }

  getSuggestions(inputStr: string): TFolder[] {
    const searchStr = inputStr.toLowerCase();

    return this.app.vault
      .getAllLoadedFiles()
      .filter(
        (file): file is TFolder =>
          file instanceof TFolder &&
          file.path.toLowerCase().contains(searchStr),
      );
  }

  renderSuggestion(folder: TFolder, el: HTMLElement): void {
    el.setText(folder.path);
  }

  selectSuggestion(value: TFolder, _evt: MouseEvent | KeyboardEvent): void {
    this.setValue(value.path);
    if (this.textInputEl.instanceOf(HTMLInputElement))
      this.textInputEl.trigger("input");
    this.close();
  }
}
