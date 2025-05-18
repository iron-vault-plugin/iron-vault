import { PlaysetAwareDataContext } from "campaigns/context";
import { IPlaysetConfig } from "campaigns/playsets/config";
import { DataswornIndexer } from "datastore/datasworn-indexer";
import { html, HTMLTemplateResult, render } from "lit-html";

import MiniSearch, { SearchResult } from "minisearch";
import { AbstractInputSuggest, App } from "obsidian";

export class DataSuggest extends AbstractInputSuggest<SearchResult> {
  #playsetContext?: PlaysetAwareDataContext;
  #index: MiniSearch<{
    name?: string;
    kind: string;
    source: string;
    _id: string;
  }>;

  constructor(
    app: App,
    readonly inputEl: HTMLInputElement,
    readonly indexer: DataswornIndexer,
  ) {
    super(app, inputEl);

    this.#index = new MiniSearch({
      fields: ["_id", "name", "kind", "source"],
      storeFields: ["name", "kind", "source"],
      idField: "_id",
      searchOptions: {
        prefix: true,
        fuzzy: 0.3,
        boost: { name: 2 },
      },
    });
    // this.#playsetContext =
    // config && new PlaysetAwareDataContext(this.indexer, config);
    for (const [_id, item] of indexer.prioritized.entries() ?? []) {
      this.#index.add({
        _id,
        kind: item.kind,
        name: (item.value as { name?: string }).name,
        source: item.source.path,
      });
    }
  }

  setPlaysetConfig(config?: IPlaysetConfig) {
    this.#playsetContext =
      config && new PlaysetAwareDataContext(this.indexer, config);
  }

  protected getSuggestions(
    query: string,
  ): SearchResult[] | Promise<SearchResult[]> {
    return this.#index?.search(query) ?? [];
  }

  renderSuggestion(value: SearchResult, el: HTMLElement): void {
    el.addClass("iv-suggestion-item");
    const isIncluded = this.#playsetContext?.prioritized.has(value.id);
    render(
      html`<span
          >${highlightTerms(value.kind, value.queryTerms)}:
          ${highlightTerms(value.name, value.queryTerms)}
          ${isIncluded ? "(included)" : "(not included)"}</span
        ><br />
        <small class="iron-vault-suggest-hint"
          >${highlightTerms(value.id, value.queryTerms)}</small
        >`,
      el,
    );
  }
}

// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_expressions#escaping
function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); // $& means the whole matched string
}

export function highlightTerms(
  input: string,
  terms: string[],
): HTMLTemplateResult {
  if (!input) return html``;

  const search = new RegExp(
    String.raw`(${terms.map(escapeRegExp).join("|")})`,
    "gi",
  );
  return html`${input
    .split(search)
    .map((term) => (term.match(search) ? html`<b>${term}</b>` : term))}`;
}
