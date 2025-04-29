import { MoveCategory } from "@datasworn/core/dist/Datasworn";
import { html, render, TemplateResult } from "lit-html";
import { map } from "lit-html/directives/map.js";
import MiniSearch from "minisearch";

import { CampaignDependentBlockRenderer } from "campaigns/campaign-source";
import { CampaignDataContext } from "campaigns/context";
import { IDataContext } from "datastore/data-context";
import { AnyDataswornMove } from "datastore/datasworn-indexer";
import IronVaultPlugin from "index";
import { ref } from "lit-html/directives/ref.js";
import { runMoveCommand } from "moves/action";
import { MoveModal, MoveRenderer, MoveRendererOptions } from "moves/move-modal";
import { MarkdownView, SearchComponent } from "obsidian";
import { runOracleCommand } from "oracles/command";
import { md } from "utils/ui/directives";
import { renderRuleset } from "./oracles";

export type IronVaultMoveRendererOptions = {
  embed?: boolean;
};

export class MoveList extends CampaignDependentBlockRenderer {
  contentEl: HTMLElement;
  index?: MiniSearch;
  targetView?: MarkdownView;
  filter: string = "";
  search: SearchComponent;

  constructor(
    containerEl: HTMLElement,
    readonly plugin: IronVaultPlugin,
    readonly options: IronVaultMoveRendererOptions = {},
    sourcePath?: string,
  ) {
    super(containerEl, plugin, sourcePath, true);
    this.contentEl = containerEl.createDiv({
      cls: "iron-vault-move-list-container",
    });
    this.search = new SearchComponent(this.contentEl)
      .setPlaceholder("Filter moves...")
      .onChange((query) => {
        this.filter = query.trim();
        this.render();
      });
  }

  shouldEmbed() {
    return this.options.embed !== undefined
      ? this.options.embed
      : !this.plugin.settings.useLegacyMoveModal;
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

  updateView(view: MarkdownView | undefined) {
    if (view !== this.targetView) {
      this.targetView = view;
      this.triggerUpdate();
    }
  }

  onNewContext(dataContext: CampaignDataContext | undefined) {
    this.index = dataContext && makeIndex(dataContext);
  }

  render() {
    const results = this.filter
      ? this.index!.search(this.filter)
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
    const onMakeMove: MoveRendererOptions["onMakeMove"] =
      this.targetView &&
      ((move, rollable) => {
        runMoveCommand(
          this.plugin,
          this.targetView!.editor,
          this.targetView!,
          move,
          rollable,
        );
      });
    const onRollOracle: MoveRendererOptions["onRollOracle"] =
      this.targetView &&
      ((oracle) => {
        runOracleCommand(
          this.plugin,
          this.targetView!.editor,
          this.targetView!,
          oracle,
        );
      });
    const tpl = html`
      <ul class="iron-vault-moves-list">
        ${map(Object.entries(sources), ([source, sourceCats]) =>
          renderRuleset({
            name: source,
            open: true,
            children: html`${map(sourceCats, (cat) =>
              renderCategory({
                name: cat.canonical_name ?? cat.name,
                color: cat.color,
                open: total <= 5,
                children: html`${map(
                  Object.values(cat.contents ?? {}),
                  (move) =>
                    html`${this.renderMove(
                      this.dataContext!.moves.get(move._id)!,
                      {
                        onMakeMove,
                        onRollOracle,
                      },
                    )}`,
                )}`,
              }),
            )}`,
          }),
        )}
      </ul>
    `;
    render(tpl, this.contentEl);
  }

  renderMove(
    move: AnyDataswornMove,
    {
      onMakeMove,
      onRollOracle,
    }: {
      onMakeMove?: MoveRendererOptions["onMakeMove"];
      onRollOracle?: MoveRendererOptions["onRollOracle"];
    },
  ) {
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
                onMakeMove: onMakeMove,
                onRollOracle: onRollOracle,
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

  renderWithoutContext(): void | Promise<void> {
    render(
      html`<article class="error">
        This block may only be used within a campaign.
      </article>`,
      this.contentEl,
    );
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

export function renderCategory({
  open,
  children,
  color,
  name,
}: {
  open: boolean;
  children: TemplateResult;
  color?: string;
  name: string;
}) {
  return html` <li
    class="move-category"
    style=${color ? `border-left: 6px solid ${color}` : ""}
  >
    <details ?open=${open}>
      <summary>
        <span>${name}</span>
      </summary>
    </details>
    <ol class="content">
      ${children}
    </ol>
  </li>`;
}
