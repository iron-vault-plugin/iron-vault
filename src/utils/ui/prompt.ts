import {
  SuggestModal,
  type App,
  type FuzzyMatch,
  type SearchResult,
} from "obsidian";

function processMatches(
  text: string,
  search: SearchResult,
  onPlain: (text: string) => void,
  onHighlighted: (text: string) => void,
): void {
  let nextChar = 0;
  for (const [start, end] of search.matches) {
    if (start - nextChar > 0) {
      onPlain(text.slice(nextChar, start));
    }
    onHighlighted(text.slice(start, end));
    nextChar = end;
  }
  const remainder = text.slice(nextChar);
  if (remainder.length > 0) {
    onPlain(remainder);
  }
}

// TODO: this is a big ol' hack
export class PromptModal extends SuggestModal<FuzzyMatch<string>> {
  private resolved: boolean = false;

  static async prompt(app: App, placeholder: string): Promise<string> {
    return await new Promise((resolve, reject) => {
      new this(app, placeholder, resolve, reject).open();
    });
  }

  private constructor(
    app: App,
    placeholder: string,
    protected readonly onSelect: (item: string) => void,
    protected readonly onCancel: () => void,
  ) {
    super(app);
    this.setPlaceholder(placeholder);
  }

  getSuggestions(
    _query: string,
  ): Array<FuzzyMatch<string>> | Promise<Array<FuzzyMatch<string>>> {
    return [];
  }

  renderSuggestion(match: FuzzyMatch<string>, el: HTMLElement) {
    el.createDiv(undefined, (div) => {
      processMatches(
        match.item,
        match.match,
        (text) => {
          div.appendText(text);
        },
        (text) => {
          div.createEl("strong", { text });
        },
      );
    });
  }

  selectSuggestion(
    value: FuzzyMatch<string>,
    evt: MouseEvent | KeyboardEvent,
  ): void {
    console.assert(!this.resolved, "selectSuggestion called more than once");
    this.resolved = true;
    super.selectSuggestion(value, evt);
  }

  onNoSuggestion(): void {
    this.chooser.setSuggestions([
      { item: this.inputEl.value, match: { matches: [], score: 0 } },
    ]);
    // this.resultContainerEl.empty();
    // const div = this.resultContainerEl.createDiv();
    // div.createEl("em", { text: `Press ⏎ to record reason or ␛ to cancel.` });
  }

  onChooseSuggestion(
    item: FuzzyMatch<string>,
    _evt: MouseEvent | KeyboardEvent,
  ): void {
    console.assert(this.resolved, "expected to already have been resolved");
    // console.log(item);
    this.onSelect(item.item);
  }

  onClose(): void {
    super.onClose();
    // console.log("closed");
    if (!this.resolved) {
      this.onCancel();
    }
  }
}
