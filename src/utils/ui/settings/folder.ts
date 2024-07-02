import { AbstractInputSuggest, TFolder } from "obsidian";

export class FolderTextSuggest extends AbstractInputSuggest<TFolder> {
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

  selectSuggestion(item: TFolder): void {
    this.setValue(item.path);
    this.close();
  }
}
