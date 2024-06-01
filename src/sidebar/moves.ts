import { Move, MoveCategory } from "@datasworn/core/dist/Datasworn";
import { html, render } from "lit-html";
import { map } from "lit-html/directives/map.js";
import MiniSearch from "minisearch";

import IronVaultPlugin from "index";
import { MoveModal } from "moves/move-modal";
import { md } from "utils/ui/directives";

export default async function renderIronVaultMoves(
  cont: HTMLElement,
  plugin: IronVaultPlugin,
) {
  const loading = cont.createEl("p", { text: "Loading data..." });
  await plugin.datastore.waitForReady;
  loading.remove();
  litHtmlMoveList(cont, plugin, makeIndex(plugin));
}

function litHtmlMoveList(
  cont: HTMLElement,
  plugin: IronVaultPlugin,
  searchIdx: MiniSearch<Move>,
  filter?: string,
) {
  const results = filter
    ? searchIdx.search(filter)
    : // TODO: use the current context
      [...plugin.datastore.moves.values()].map((m) => ({ id: m._id }));
  const categories = plugin.datastore.moveCategories.values();
  let total = 0;
  const newCats = [];
  for (const cat of categories) {
    const contents = Object.values(cat.contents ?? {});
    const filtered = contents.filter((m) =>
      results.find((res) => m._id === res.id),
    );
    if (filtered.length) {
      newCats.push({
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
        litHtmlMoveList(cont, plugin, searchIdx, input.value);
      }}
    />
    <ol class="iron-vault-moves-list">
      ${map(newCats, (cat) => renderCategory(plugin, cat, total <= 5))}
    </ol>
  `;
  render(tpl, cont);
}

function renderCategory(
  plugin: IronVaultPlugin,
  category: MoveCategory,
  open: boolean,
) {
  return html`
  <li class="category" style=${category.color ? `border-left: 6px solid ${category.color}` : ""}>
    <div class="wrapper">
      <details ?open=${open}>
        <summary><span>${category.canonical_name ?? category.name}</span></summary>
      </details>
      <ol class="content">
        ${map(Object.values(category.contents ?? {}), (move) => html`${renderMove(plugin, move)}`)}
      </ol>
  </li>`;
}

function renderMove(plugin: IronVaultPlugin, move: Move) {
  return html`
    <li
      @click=${(ev: Event) => {
        ev.preventDefault();
        ev.stopPropagation();
        new MoveModal(plugin.app, plugin, move).open();
      }}
    >
      <header>${move.name}</header>
      ${md(plugin, move.trigger.text)}
    </li>
  `;
}

function makeIndex(plugin: IronVaultPlugin) {
  const idx = new MiniSearch({
    fields: ["name", "trigger.text"],
    idField: "_id",
    searchOptions: {
      prefix: true,
      fuzzy: 0.3,
      boost: { name: 2 },
    },
  });
  // TODO: use the current context
  idx.addAll([...plugin.datastore.moves.values()]);
  return idx;
}
