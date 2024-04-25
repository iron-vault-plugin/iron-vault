import {
  SuggestModal,
  prepareFuzzySearch,
  sortSearchResults,
  type App,
  type FuzzyMatch,
  type SearchResult,
} from "obsidian";

export function processMatches(
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

export class AddsModal extends SuggestModal<FuzzyMatch<string>> {
  private resolved: boolean = false;

  static async show(app: App, addAmount: string): Promise<string> {
    return this.select(
      app,
      [],
      (x) => x,
      `(Optional) Provide a reason for this ${addAmount} add and press enter.`,
    );
  }

  static async select(
    app: App,
    items: string[],
    renderExtras?: (match: FuzzyMatch<string>, el: HTMLElement) => void,
    placeholder?: string,
  ): Promise<string> {
    return await new Promise((resolve, reject) => {
      new this(
        app,
        items,
        (x) => x,
        (match, el) => {
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
          if (renderExtras != null) {
            renderExtras(match, el);
          }
        },
        resolve,
        reject,
        placeholder,
      ).open();
    });
  }

  // static async selectCustom<T>(
  //   app: App,
  //   items: T[],
  //   getItemText: (item: T) => string,
  //   renderSuggestion: (match: FuzzyMatch<T>, el: HTMLElement) => void,
  //   placeholder?: string,
  // ): Promise<T> {
  //   return await new Promise((resolve, reject) => {
  //     new this(
  //       app,
  //       items,
  //       getItemText,
  //       renderSuggestion,
  //       resolve,
  //       reject,
  //       placeholder,
  //     ).open();
  //   });
  // }

  private constructor(
    app: App,
    protected readonly items: string[],
    protected readonly getTtemText: (item: string) => string,
    public readonly renderSuggestion: (
      match: FuzzyMatch<string>,
      el: HTMLElement,
    ) => void,
    protected readonly onSelect: (item: string) => void,
    protected readonly onCancel: () => void,
    placeholder?: string,
  ) {
    super(app);
    if (placeholder) {
      this.setPlaceholder(placeholder);
    }
  }

  getSuggestions(
    query: string,
  ): Array<FuzzyMatch<string>> | Promise<Array<FuzzyMatch<string>>> {
    const fuzzyScore = prepareFuzzySearch(query);
    const results = this.items.flatMap((item) => {
      const match = fuzzyScore(this.getTtemText(item));
      return match != null
        ? [
            {
              item,
              match,
            },
          ]
        : [];
    });
    sortSearchResults(results);
    return results;
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
