import {
  AbstractInputSuggest,
  App,
  FuzzyMatch,
  prepareFuzzySearch,
} from "obsidian";
import { processMatches } from "utils/suggest";

export class GenericTextSuggest extends AbstractInputSuggest<
  FuzzyMatch<string>
> {
  constructor(
    app: App,
    readonly inputEl: HTMLInputElement,
    public readonly items: string[],
  ) {
    super(app, inputEl);
  }

  getSuggestions(inputStr: string): FuzzyMatch<string>[] {
    const searchFn = prepareFuzzySearch(inputStr);
    return this.items
      .flatMap((item) => {
        const match = searchFn(item);
        if (match) {
          return [{ item, match }];
        } else {
          return [];
        }
      })
      .sort((a, b) => a.match.score - b.match.score);
  }

  renderSuggestion({ item, match }: FuzzyMatch<string>, el: HTMLElement): void {
    if (item == null) return;

    el.createDiv(undefined, (div) => {
      processMatches(
        item,
        match,
        (text) => {
          div.appendText(text);
        },
        (text) => {
          div.createEl("strong", { text });
        },
      );
    });
    // if (renderExtras != null) {
    //   renderExtras(match, el);
    // }
  }

  selectSuggestion({ item }: FuzzyMatch<string>): void {
    this.setValue(item);
    if (this.inputEl.instanceOf(HTMLInputElement))
      this.inputEl.trigger("input");
    this.close();
  }
}
