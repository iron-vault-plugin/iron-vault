import { Move, MoveCategory } from "@datasworn/core/dist/Datasworn";
import { html, render } from "lit-html";
import { map } from "lit-html/directives/map.js";

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
  litHtmlMoveList(cont, plugin);
}

function litHtmlMoveList(cont: HTMLElement, plugin: IronVaultPlugin) {
  const tpl = html`
    <ol class="iron-vault-moves-list">
      ${map(plugin.datastore.moveCategories.values(), (cat) =>
        renderCategory(plugin, cat),
      )}
    </ol>
  `;
  render(tpl, cont);
}

function renderCategory(plugin: IronVaultPlugin, category: MoveCategory) {
  return html`
  <li class="category" style=${category.color ? `border-left: 6px solid ${category.color}` : ""}>
    <div class="wrapper">
      <details>
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
