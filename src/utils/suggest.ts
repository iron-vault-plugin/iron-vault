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

export type UserChoice<T, U = undefined> =
  | { kind: "custom"; custom: string; value: U }
  | { kind: "pick"; value: T };

export class CustomSuggestModal<T> extends SuggestModal<FuzzyMatch<T>> {
  private resolved: boolean = false;

  static async select<T>(
    app: App,
    items: T[],
    getItemText: (item: T) => string,
    renderExtras?: (match: FuzzyMatch<T>, el: HTMLElement) => void,
    placeholder?: string,
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
        placeholder,
      ).open();
    });
  }

  /** Allow user to select from a list or a custom option. */
  static async selectWithUserEntry<T>(
    app: App,
    items: T[],
    getItemText: (item: T) => string,
    renderUserEntry: (input: string, el: HTMLElement) => void,
    renderExtras: (match: FuzzyMatch<T>, el: HTMLElement) => void,
    placeholder: string,
  ): Promise<UserChoice<T, undefined>>;
  static async selectWithUserEntry<T, U = T>(
    app: App,
    items: T[],
    getItemText: (item: T) => string,
    renderUserEntry: (input: string, el: HTMLElement) => void,
    renderExtras: (match: FuzzyMatch<T>, el: HTMLElement) => void,
    placeholder: string,
    createUserValue: (input: string) => U,
  ): Promise<UserChoice<T, U>>;
  static async selectWithUserEntry<T>(
    app: App,
    items: T[],
    getItemText: (item: T) => string,
    renderUserEntry: (input: string, el: HTMLElement) => void,
    renderExtras: (match: FuzzyMatch<T>, el: HTMLElement) => void,
    placeholder: string,
    createUserValue?: (input: string) => unknown,
  ): Promise<UserChoice<T, unknown>> {
    return await new Promise((resolve, reject) => {
      new this<UserChoice<T, unknown>>(
        app,
        items.map((value) => ({ kind: "pick", value })),
        (choice) =>
          choice.kind == "custom" ? choice.custom : getItemText(choice.value),
        ({ item, match }, el) => {
          if (item.kind == "custom") {
            el.createDiv(undefined, (div) => renderUserEntry(item.custom, div));
          } else {
            el.createDiv(undefined, (div) => {
              processMatches(
                getItemText(item.value),
                match,
                (text) => {
                  div.appendText(text);
                },
                (text) => {
                  div.createEl("strong", { text });
                },
              );
            });
            if (renderExtras != null) {
              renderExtras({ match, item: item.value }, el);
            }
          }
        },
        resolve,
        reject,
        placeholder,
        (custom) => ({
          kind: "custom",
          custom,
          value: createUserValue ? createUserValue(custom) : undefined,
        }),
      ).open();
    });
  }

  static async selectCustom<T>(
    app: App,
    items: T[],
    getItemText: (item: T) => string,
    renderSuggestion: (match: FuzzyMatch<T>, el: HTMLElement) => void,
    placeholder?: string,
  ): Promise<T> {
    return await new Promise((resolve, reject) => {
      new this(
        app,
        items,
        getItemText,
        renderSuggestion,
        resolve,
        reject,
        placeholder,
      ).open();
    });
  }

  private constructor(
    app: App,
    protected readonly items: T[],
    protected readonly getTtemText: (item: T) => string,
    public readonly renderSuggestion: (
      match: FuzzyMatch<T>,
      el: HTMLElement,
    ) => void,
    protected readonly onSelect: (item: T) => void,
    protected readonly onCancel: () => void,
    placeholder?: string,
    protected readonly customItem?: (input: string) => T,
  ) {
    super(app);
    if (placeholder) {
      this.setPlaceholder(placeholder);
    }
  }

  getSuggestions(
    query: string,
  ): Array<FuzzyMatch<T>> | Promise<Array<FuzzyMatch<T>>> {
    const fuzzyScore = prepareFuzzySearch(query);
    const results: FuzzyMatch<T>[] = this.items.flatMap((item) => {
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
    if (query != "" && this.customItem) {
      results.push({
        item: this.customItem(query),
        match: { score: Number.NEGATIVE_INFINITY, matches: [] },
      });
    }
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
    this.onSelect(item.item);
  }

  onClose(): void {
    super.onClose();
    if (!this.resolved) {
      this.onCancel();
    }
  }
}
