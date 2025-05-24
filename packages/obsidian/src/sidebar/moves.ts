import { MoveCategory } from "@datasworn/core/dist/Datasworn";
import { html, noChange, nothing, render } from "lit-html";
import MiniSearch from "minisearch";

import { CampaignDependentBlockRenderer } from "campaigns/campaign-source";
import { CampaignDataContext } from "campaigns/context";
import { IDataContext } from "datastore/data-context";
import {
  AnyDataswornMove,
  MoveWithSelector,
  WithMetadata,
} from "datastore/datasworn-indexer";
import IronVaultPlugin from "index";
import { AsyncDirective } from "lit-html/async-directive.js";
import {
  ChildPart,
  directive,
  PartInfo,
  PartType,
} from "lit-html/directive.js";
import { repeat } from "lit-html/directives/repeat.js";
import { styleMap } from "lit-html/directives/style-map.js";
import { runMoveCommand } from "moves/action";
import { MoveModal, MoveRenderer, MoveRendererOptions } from "moves/move-modal";
import { Component, MarkdownView, SearchComponent } from "obsidian";
import { runOracleCommand } from "oracles/command";
import { md } from "utils/ui/directives";
import {
  CollapseExpandDecorator,
  renderGrouping,
  renderRuleset,
} from "./content-tree";

export type IronVaultMoveRendererOptions = {
  embed?: boolean;
};

export class MoveList extends CampaignDependentBlockRenderer {
  contentEl: HTMLElement;
  index?: MiniSearch;
  targetView?: MarkdownView;
  filter: string = "";
  search: SearchComponent;
  collapseExpandDec: CollapseExpandDecorator;

  constructor(
    containerEl: HTMLElement,
    readonly plugin: IronVaultPlugin,
    readonly options: IronVaultMoveRendererOptions = {},
    sourcePath?: string,
  ) {
    super(containerEl, plugin, sourcePath, {
      watchDataIndex: true,
      watchSettings: ["useLegacyMoveModal"],
      watchActiveCharacter: true,
      debouncePeriod: 100,
    });
    this.contentEl = containerEl.createDiv({
      cls: "iron-vault-move-list-container",
    });

    this.search = new SearchComponent(this.contentEl)
      .setPlaceholder("Filter moves...")
      .onChange((query) => {
        this.filter = query.trim();
        this.render();
      });

    this.collapseExpandDec = new CollapseExpandDecorator(
      this.search,
      "expand-all",
    ).onClick((method) => {
      this.contentEl
        .querySelectorAll<HTMLDetailsElement>(
          "li:not([style *= 'display: none']) > details",
        )
        .forEach((detailsEl) => {
          // We want to expand all rulesets, and close all other details.
          const shouldExpand =
            method === "expand-all" ||
            (detailsEl.parentElement?.hasClass("ruleset") ?? false);
          detailsEl.open = shouldExpand;
        });
    });
  }

  updateCollapseExpand(method?: "collapse-all" | "expand-all") {
    if (!method) {
      const openElements = this.contentEl.querySelectorAll(
        "li:not(.ruleset):not([style *= 'display: none']) > details[open]",
      );
      method = openElements.length > 0 ? "collapse-all" : "expand-all";
    }
    this.collapseExpandDec.setMethod(method);
  }

  shouldEmbed() {
    return this.options.embed !== undefined
      ? this.options.embed
      : !this.plugin.settings.useLegacyMoveModal;
  }

  onunload() {
    this.contentEl.remove();
    super.onunload();
  }

  scrollToMove(id: string) {
    this.search.setValue("").onChanged(); // Clear the search filter

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
    const matches = new Set(
      this.filter
        ? this.index!.search(this.filter).map((r): string => r.id)
        : [...this.dataContext.moves.values()].map((m) => m._id),
    );

    const categories = this.dataContext.moveCategories.values();
    const sources: Record<string, MoveCategory[]> = {};
    for (const cat of categories) {
      if (!sources[cat._source.title]) {
        sources[cat._source.title] = [];
      }
      sources[cat._source.title].push(cat);
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
    const onToggle = () => this.updateCollapseExpand();
    const tpl = html`
      <ul class="iron-vault-moves-list">
        ${repeat(
          Object.entries(sources),
          ([source]) => source,
          ([source, sourceCats]) =>
            renderRuleset({
              name: source,
              open: true,
              children: repeat(
                sourceCats,
                (cat) => cat._id,
                (cat) =>
                  renderGrouping({
                    name: cat.canonical_name ?? cat.name,
                    listItemClass: "move-category",
                    color: cat.color,
                    hidden: !Object.values(cat.contents ?? {}).some((move) =>
                      matches.has(move._id),
                    ),
                    open: this.filter ? true : undefined,
                    onToggle,
                    children: html`${repeat(
                      Object.values(cat.contents ?? {}),
                      (move) => move._id,
                      (move) =>
                        html`${this.renderMove(
                          this.dataContext!.moves.get(move._id)!,
                          {
                            hidden: !matches.has(move._id),
                            open: matches.size <= 5 ? true : undefined,
                            onMakeMove,
                            onRollOracle,
                            onToggle,
                          },
                        )}`,
                    )}`,
                  }),
              ),
            }),
        )}
      </ul>
    `;
    render(tpl, this.contentEl);
  }

  renderMove(
    move: AnyDataswornMove,
    {
      hidden,
      open,
      onMakeMove,
      onRollOracle,
      onToggle,
    }: {
      hidden?: boolean;
      open?: boolean;
      onMakeMove?: MoveRendererOptions["onMakeMove"];
      onRollOracle?: MoveRendererOptions["onRollOracle"];
      onToggle?: (ev: ToggleEvent) => void;
    },
  ) {
    if (this.shouldEmbed()) {
      return html`
        <li
          class="move-item"
          data-datasworn-id="${move._id}"
          style=${styleMap({
            display: hidden ? "none" : undefined,
          })}
        >
          <details
            @toggle=${onToggle || nothing}
            .open=${hidden || open === undefined ? nothing : open}
          >
            <summary>${move.name}</summary>
            ${moveRenderer(this.plugin, this.dataContext!, move, this, {
              showOracles: true,
              actionContext: this.actionContext,
              onMakeMove: onMakeMove,
              onRollOracle: onRollOracle,
            })}
          </details>
        </li>
      `;
    } else {
      return html`
        <li
          class="move-item"
          data-datasworn-id="${move._id}"
          style=${styleMap({
            display: hidden ? "none" : undefined,
          })}
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

class MoveRendererDirective extends AsyncDirective {
  _renderer: MoveRenderer | undefined;
  _component: Component | undefined;

  constructor(partInfo: PartInfo) {
    super(partInfo);
    if (partInfo.type !== PartType.CHILD) {
      throw new Error(
        `Invalid part type ${partInfo.type} for MoveRendererDirective`,
      );
    }
  }

  protected disconnected(): void {
    console.log("MoveRendererDirective: disconnected");
    if (this._renderer && this._component) {
      console.log(
        "MoveRendererDirective: disconnected, removing renderer from component",
      );
      this._component.removeChild(this._renderer);
    }
  }

  protected reconnected(): void {
    if (this._renderer && this._component) {
      console.log(
        "MoveRendererDirective: reconnected, adding renderer to component",
      );
      this._component.addChild(this._renderer);
    }
  }

  update(
    _part: ChildPart,
    [plugin, dataContext, move, component, options]: Parameters<
      MoveRendererDirective["render"]
    >,
  ): unknown {
    if (this._component && this._component !== component) {
      if (this._renderer) {
        this._component.removeChild(this._renderer);
        if (this.isConnected) {
          component.addChild(this._renderer);
        }
      }
    }

    this._component = component;

    if (!this._renderer) {
      if (!this.isConnected) return noChange;

      const tempEl = document.createElement("div");
      this._renderer = new MoveRenderer(
        tempEl,
        plugin,
        dataContext,
        move,
        options ?? {},
      );
      this._renderer?.initialize();
      return tempEl;
    } else if (
      this._renderer.options.actionContext !== options?.actionContext
    ) {
      this._renderer.updateActionContext(options?.actionContext);
    }

    return noChange;
  }

  render(
    _plugin: IronVaultPlugin,
    _dataContext: IDataContext,
    _move: AnyDataswornMove,
    _component: Component,
    _options: MoveRendererOptions | undefined = {},
  ): unknown {
    return noChange;
  }
}

export const moveRenderer = directive(MoveRendererDirective);

function makeIndex(dataContext: IDataContext) {
  const idx = new MiniSearch<WithMetadata<MoveWithSelector>>({
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
