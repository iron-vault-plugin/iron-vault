import { TFolder } from "obsidian";
import { TextInputSuggest } from "../suggest";

export class FolderTextSuggest extends TextInputSuggest<TFolder> {
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
    this.inputEl.value = item.path;
    this.inputEl.trigger("input");
    this.close();
  }
}
