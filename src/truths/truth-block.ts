import { html, render } from "lit-html";
import { map } from "lit-html/directives/map.js";

import IronVaultPlugin from "index";
import { EventRef, MarkdownRenderChild } from "obsidian";
import { md } from "utils/ui/directives";
import { TruthOption } from "@datasworn/core/dist/Datasworn";

export default function registerTruthBlock(plugin: IronVaultPlugin): void {
  plugin.registerMarkdownCodeBlockProcessor(
    "iron-vault-truth",
    async (source: string, el: TruthContainerEl, ctx) => {
      await plugin.datastore.waitForReady;
      if (!el.truthRenderer) {
        el.truthRenderer = new TruthRenderer(
          el,
          ctx.sourcePath,
          plugin,
          source,
        );
      }
      el.truthRenderer.render();
    },
  );
}

interface TruthContainerEl extends HTMLElement {
  truthRenderer?: TruthRenderer;
}

class TruthRenderer extends MarkdownRenderChild {
  sourcePath: string;
  plugin: IronVaultPlugin;
  source: string;
  fileWatcher?: EventRef;
  selectedOption?: TruthOption;
  selectedOptionSubIndex?: number;

  constructor(
    containerEl: HTMLElement,
    sourcePath: string,
    plugin: IronVaultPlugin,
    source: string,
  ) {
    super(containerEl);
    this.sourcePath = sourcePath;
    this.plugin = plugin;
    this.source = source.trim().toLowerCase();
  }

  render() {
    const truth = [...this.plugin.datastore.truths.values()].find((truth) => {
      return truth.name.toLowerCase() === this.source;
    });
    if (!truth) {
      render(
        html`<article class="error">Truth not found: ${this.source}</article>`,
        this.containerEl,
      );
      return;
    }
    const optionSelect =
      this.selectedOption?.table &&
      html`<select
          @change=${(e: Event) => {
            this.selectedOptionSubIndex =
              (e.target as HTMLSelectElement).selectedIndex - 1;
            this.render();
          }}
        >
          <option disabled selected>Select your option...</option>
          ${map(
            this.selectedOption.table.rows,
            (row) => html`<option>${row.text}</option>`,
          )}
        </select>
        <button type="button">Roll</button>`;
    const tpl = html`
      <article class="iron-vault-truth">
        <header>${truth.name}</header>
        <select
          @change=${(e: Event) => {
            this.selectedOption =
              truth.options[(e.target as HTMLSelectElement).selectedIndex - 1];
            this.selectedOptionSubIndex = undefined;
            this.render();
          }}
        >
          <option disabled selected>Select your truth...</option>
          ${map(
            truth.options,
            (option) => html`
              <!-- TODO: table -->
              <option>
                ${md(this.plugin, option.summary ?? option.description)}
              </option>
            `,
          )}
        </select>
        <button type="button">Roll</button>
        <section>
          ${!this.selectedOption
            ? null
            : md(
                this.plugin,
                this.selectedOption.description
                  .replaceAll(/{{table:[^}]+}}/g, "")
                  .trim(),
              )}
          ${optionSelect}
          <br />
          ${this.selectedOption &&
          (!this.selectedOption.table || this.selectedOptionSubIndex != null)
            ? html`<button type="button">Save</button>`
            : null}
        </section>
      </article>
    `;
    render(tpl, this.containerEl);
  }
}
