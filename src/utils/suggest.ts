import {
  type App,
  type FuzzyMatch,
  SuggestModal,
  prepareFuzzySearch,
  sortSearchResults,
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

export class CustomSuggestModal<T> extends SuggestModal<FuzzyMatch<T>> {
  private resolved: boolean = false;

  static async select<T>(
    app: App,
    items: T[],
    getItemText: (item: T) => string,
    renderExtras?: (match: FuzzyMatch<T>, el: HTMLElement) => void,
  ): Promise<T> {
    return await new Promise((resolve, reject) => {
      new this<T>(
        app,
        items,
        getItemText,
        (match, el) => {
          el.createDiv(undefined, (div) => {
            processMatches(
              getItemText(match.item),
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
      ).open();
    });
  }

  static async selectCustom<T>(
    app: App,
    items: T[],
    getItemText: (item: T) => string,
    renderSuggestion: (match: FuzzyMatch<T>, el: HTMLElement) => void,
  ): Promise<T> {
    return await new Promise((resolve, reject) => {
      new this(
        app,
        items,
        getItemText,
        renderSuggestion,
        resolve,
        reject,
      ).open();
    });
  }

  constructor(
    app: App,
    protected readonly items: T[],
    protected readonly getTtemText: (item: T) => string,
    public readonly renderSuggestion: (
      match: FuzzyMatch<T>,
      el: HTMLElement,
    ) => void,
    protected readonly onSelect: (item: T) => void,
    protected readonly onCancel: () => void,
  ) {
    super(app);
  }

  getSuggestions(
    query: string,
  ): Array<FuzzyMatch<T>> | Promise<Array<FuzzyMatch<T>>> {
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

  // renderSuggestion({ item, match }: FuzzyMatch<T>, el: HTMLElement): void {
  //   el.createDiv(undefined, (div) => {
  //     processMatches(
  //       move.Title.Standard,
  //       match,
  //       (text) => {
  //         div.appendText(text);
  //       },
  //       (text) => {
  //         div.createEl("strong", { text });
  //       },
  //     );
  //   });
  //   // el.createEl("div", { text: move.item.Title.Standard });
  //   const moveKind = getMoveKind(move);
  //   el.createEl("small", { text: `(${moveKind}) ${move.Trigger.Text}` });
  // }

  selectSuggestion(
    value: FuzzyMatch<T>,
    evt: MouseEvent | KeyboardEvent,
  ): void {
    console.assert(!this.resolved, "selectSuggestion called more than once");
    this.resolved = true;
    super.selectSuggestion(value, evt);
  }

  onChooseSuggestion(
    item: FuzzyMatch<T>,
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
