import { MoveCategory } from "@datasworn/core/dist/Datasworn";
import { html, render } from "lit-html";
import { map } from "lit-html/directives/map.js";
import MiniSearch from "minisearch";

import { CampaignDataContext } from "campaigns/context";
import { currentActiveCharacterForCampaign } from "character-tracker";
import {
  IActionContext,
  NoCharacterActionConext,
} from "characters/action-context";
import { IDataContext } from "datastore/data-context";
import { AnyDataswornMove } from "datastore/datasworn-indexer";
import IronVaultPlugin from "index";
import { ref } from "lit-html/directives/ref.js";
import { runMoveCommand } from "moves/action";
import { MoveModal, MoveRenderer } from "moves/move-modal";
import { Component, MarkdownView } from "obsidian";
import { runOracleCommand } from "oracles/command";
import { md } from "utils/ui/directives";

export type IronVaultMoveRendererOptions = {
  embed?: boolean;
};

export class MoveList extends Component {
  contentEl: HTMLElement;
  index?: MiniSearch;
  dataContext?: IDataContext;
  targetView?: MarkdownView;
  actionContext: IActionContext | undefined;
  filter: string = "";

  constructor(
    containerEl: HTMLElement,
    readonly plugin: IronVaultPlugin,
    readonly options: IronVaultMoveRendererOptions = {},
  ) {
    super();
    this.contentEl = containerEl.createDiv({
      cls: "iron-vault-move-list-container",
    });
  }

  shouldEmbed() {
    return this.options.embed !== undefined
      ? this.options.embed
      : !this.plugin.settings.useLegacyMoveModal;
  }

  onload() {
    this.render();
  }

  onunload() {
    this.contentEl.remove();
  }

  scrollToMove(id: string) {
    this.filter = "";
    this.render();
    const targetEl = this.contentEl.querySelector(
      `li.move-item[data-datasworn-id="${id}"]`,
    );
    if (!targetEl) {
      console.warn(`Move with id ${id} not found in the move list`);
      return;
    }

    const targetDetails = targetEl.querySelector("details")!;
    targetDetails.open = true; // Ensure the details element is open

    // Note that currently the content for categories/rulesets is in an
    // element ADJACENT to the details instead of inside it, so we look
    // for an ancestor that has a details child.
    let parentEl: Element | null | undefined =
      targetEl.closest(":has(> details)");
    while (parentEl && this.contentEl.contains(parentEl)) {
      parentEl.querySelector("details")!.open = true;
      parentEl = parentEl.parentElement?.closest(":has(> details)");
    }

    // setTimeout is necessary to ensure the scroll happens after the DOM update
    // that opens the details element.
    setTimeout(
      () =>
        targetDetails.scrollIntoView({
          behavior: "smooth",
          block: "start",
          inline: "nearest",
        }),
      0,
    );
  }

  async updateContext(
    dataContext: IDataContext | undefined,
    targetView: MarkdownView | undefined,
  ) {
    this.dataContext = dataContext;
    this.targetView = targetView;
    this.actionContext =
      dataContext instanceof CampaignDataContext
        ? (currentActiveCharacterForCampaign(this.plugin, dataContext) ??
          new NoCharacterActionConext(dataContext))
        : undefined;
    this.index = dataContext && makeIndex(dataContext);
    this.render();
  }

  render() {
    if (!this.dataContext || !this.index) {
      render(html`<p>No moves available.</p>`, this.contentEl);
      return;
    }

    const results = this.filter
      ? this.index.search(this.filter)
      : [...this.dataContext.moves.values()].map((m) => ({ id: m._id }));
    const categories = this.dataContext.moveCategories.values();
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
          this.filter = input.value.trim();
          this.render();
        }}
      />
      <ul class="iron-vault-moves-list">
        ${map(
          Object.entries(sources),
          ([source, sourceCats]) =>
            html`<li class="ruleset">
              <details open>
                <summary>
                  <span>${source}</span>
                </summary>
              </details>
              <ul class="content">
                ${map(sourceCats, (cat) =>
                  this.renderCategory(cat, total <= 5),
                )}
              </ul>
            </li>`,
        )}
      </ul>
    `;
    render(tpl, this.contentEl);
  }

  renderCategory(category: MoveCategory, open: boolean) {
    return html` <li
      class="move-category"
      style=${category.color ? `border-left: 6px solid ${category.color}` : ""}
    >
      <details ?open=${open}>
        <summary>
          <span>${category.canonical_name ?? category.name}</span>
        </summary>
      </details>
      <ol class="content">
        ${map(
          Object.values(category.contents ?? {}),
          (move) =>
            html`${this.renderMove(this.dataContext!.moves.get(move._id)!)}`,
        )}
      </ol>
    </li>`;
  }

  renderMove(move: AnyDataswornMove) {
    if (this.shouldEmbed()) {
      let renderer: MoveRenderer | undefined;
      const callback = async (el?: Element) => {
        if (el instanceof HTMLElement) {
          if (!renderer) {
            renderer = await MoveRenderer.render(
              el,
              this.plugin,
              this.dataContext!,
              move,
              this,
              {
                showOracles: true,
                actionContext: this.actionContext,
                onMakeMove:
                  this.targetView &&
                  ((move, rollable) => {
                    runMoveCommand(
                      this.plugin,
                      this.targetView!.editor,
                      this.targetView!,
                      move,
                      rollable,
                    );
                  }),
                onRollOracle:
                  this.targetView &&
                  ((oracle) => {
                    runOracleCommand(
                      this.plugin,
                      this.targetView!.editor,
                      this.targetView!,
                      oracle,
                    );
                  }),
              },
            );
          }
        } else if (renderer) {
          this.removeChild(renderer);
          renderer = undefined;
        }
      };
      return html`
        <li class="move-item" data-datasworn-id="${move._id}">
          <details>
            <summary>${move.name}</summary>
            <div ${ref(callback)}></div>
          </details>
        </li>
      `;
    } else {
      return html`
        <li
          class="move-item"
          data-datasworn-id="${move._id}"
          @click=${(ev: Event) => {
            ev.preventDefault();
            ev.stopPropagation();
            new MoveModal(
              this.plugin.app,
              this.plugin,
              this.dataContext!,
              move,
            ).open();
          }}
        >
          <header>${move.name}</header>
          ${md(this.plugin, move.trigger.text)}
        </li>
      `;
    }
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
