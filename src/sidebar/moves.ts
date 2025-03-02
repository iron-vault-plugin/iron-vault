import { Move, MoveCategory } from "@datasworn/core/dist/Datasworn";
import { html, render } from "lit-html";
import { map } from "lit-html/directives/map.js";
import MiniSearch from "minisearch";

import { IDataContext } from "datastore/data-context";
import { AnyDataswornMove } from "datastore/datasworn-indexer";
import IronVaultPlugin from "index";
import { MoveModal, MoveRenderer } from "moves/move-modal";
import { Component } from "obsidian";
import { md } from "utils/ui/directives";

export type IronVaultMoveRendererOptions = {
  embed?: boolean;
  embedParent?: Component;
};

export default function renderIronVaultMoves(
  cont: HTMLElement,
  plugin: IronVaultPlugin,
  dataContext: IDataContext,
  options: IronVaultMoveRendererOptions = {},
) {
  litHtmlMoveList(cont, plugin, dataContext, makeIndex(dataContext), options);
}

function litHtmlMoveList(
  cont: HTMLElement,
  plugin: IronVaultPlugin,
  dataContext: IDataContext,
  searchIdx: MiniSearch<Move>,
  options: IronVaultMoveRendererOptions = {},
  filter?: string,
) {
  const results = filter
    ? searchIdx.search(filter)
    : [...dataContext.moves.values()].map((m) => ({ id: m._id }));
  const categories = dataContext.moveCategories.values();
  let total = 0;
  const sources: Record<string, MoveCategory[]> = {};
  for (const cat of categories) {
    const contents = Object.values(cat.contents ?? {});
    const filtered = contents.filter((m) =>
      results.find((res) => m._id === res.id),
    );
    if (filtered.length) {
      if (!sources[cat._source.title]) {
        sources[cat._source.title] = [];
      }
      sources[cat._source.title].push({
        ...cat,
        contents: Object.fromEntries(filtered.map((m) => [m._id, m])),
      });
      total += filtered.length;
    }
  }
  const tpl = html`
    <input
      class="search-box"
      type="search"
      placeholder="Filter moves..."
      @input=${(e: Event) => {
        const input = e.target as HTMLInputElement;
        litHtmlMoveList(
          cont,
          plugin,
          dataContext,
          searchIdx,
          options,
          input.value,
        );
      }}
    />
    <ul class="iron-vault-moves-list">
      ${map(
        Object.entries(sources),
        ([source, sourceCats]) =>
          html` <li class="ruleset">
            <div class="wrapper">
              <details open>
                <summary>
                  <span>${source}</span>
                </summary>
              </details>
              <ul class="content">
                ${map(sourceCats, (cat) =>
                  renderCategory(plugin, dataContext, cat, total <= 5, options),
                )}
              </ul>
            </div>
          </li>`,
      )}
    </ul>
  `;
  render(tpl, cont);
}

function renderCategory(
  plugin: IronVaultPlugin,
  dataContext: IDataContext,
  category: MoveCategory,
  open: boolean,
  options: IronVaultMoveRendererOptions,
) {
  return html` <li
    class="move-category"
    style=${category.color ? `border-left: 6px solid ${category.color}` : ""}
  >
    <div class="wrapper">
      <details ?open=${open}>
        <summary>
          <span>${category.canonical_name ?? category.name}</span>
        </summary>
      </details>
      <ol class="content">
        ${map(
          Object.values(category.contents ?? {}),
          (move) =>
            html`${renderMove(
              plugin,
              dataContext,
              dataContext.moves.get(move._id)!,
              options,
            )}`,
        )}
      </ol>
    </div>
  </li>`;
}

function renderMove(
  plugin: IronVaultPlugin,
  dataContext: IDataContext,
  move: AnyDataswornMove,
  options: IronVaultMoveRendererOptions,
) {
  if (options.embed) {
    return html`
      <li>
        <header>${move.name}</header>
        <div
          ref=${(el: HTMLElement) =>
            el &&
            MoveRenderer.render(
              plugin,
              dataContext,
              move,
              options.embedParent!,
            )}
        ></div>
      </li>
    `;
  } else {
    return html`
      <li
        @click=${(ev: Event) => {
          ev.preventDefault();
          ev.stopPropagation();
          new MoveModal(plugin.app, plugin, dataContext, move).open();
        }}
      >
        <header>${move.name}</header>
        ${md(plugin, move.trigger.text)}
      </li>
    `;
  }
}

function makeIndex(dataContext: IDataContext) {
  const idx = new MiniSearch({
    fields: ["name", "trigger.text"],
    idField: "_id",
    searchOptions: {
      prefix: true,
      fuzzy: 0.3,
      boost: { name: 2 },
    },
  });
  idx.addAll([...dataContext.moves.values()]);
  return idx;
}
