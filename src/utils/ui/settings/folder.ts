import { html, render } from "lit-html";
import { AbstractInputSuggest, App, TFolder, Vault } from "obsidian";
import { getRelativePath } from "utils/obsidian";

export class FolderTextSuggest extends AbstractInputSuggest<TFolder> {
  baseFolder: TFolder = this.app.vault.getRoot();

  constructor(
    app: App,
    readonly textInputEl: HTMLInputElement | HTMLDivElement,
  ) {
    super(app, textInputEl);
  }

  setBaseFolder(folder: TFolder): this {
    this.baseFolder = folder;
    return this;
  }

  getSuggestions(inputStr: string): TFolder[] {
    const searchStr = inputStr.toLowerCase();

    const results: TFolder[] = [];
    Vault.recurseChildren(this.baseFolder, (file) => {
      if (
        file instanceof TFolder &&
        file.path.toLowerCase().contains(searchStr)
      ) {
        results.push(file);
      }
    });

    return results;
  }

  renderSuggestion(folder: TFolder, el: HTMLElement): void {
    const relativePath = getRelativePath(this.baseFolder, folder);
    render(
      html`${this.baseFolder.isRoot()
        ? ""
        : html`<span class="iron-vault-suggest-hint"
            >${this.baseFolder.path}/</span
          >`}${relativePath}`,
      el,
    );
  }

  selectSuggestion(value: TFolder, _evt: MouseEvent | KeyboardEvent): void {
    this.setValue(getRelativePath(this.baseFolder, value));
    if (this.textInputEl.instanceOf(HTMLInputElement))
      this.textInputEl.trigger("input");
    this.close();
  }
}
