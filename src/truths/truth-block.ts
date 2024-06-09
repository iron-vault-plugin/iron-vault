import { html, render } from "lit-html";
import { map } from "lit-html/directives/map.js";
import { ref } from "lit-html/directives/ref.js";
import {
  EventRef,
  MarkdownPostProcessorContext,
  MarkdownRenderChild,
  setIcon,
} from "obsidian";
import {
  OracleTableRowText,
  Truth,
  TruthOption,
} from "@datasworn/core/dist/Datasworn";

import IronVaultPlugin from "index";
import { md } from "utils/ui/directives";
import { Dice } from "utils/dice";

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
          ctx,
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
  ctx: MarkdownPostProcessorContext;

  constructor(
    containerEl: HTMLElement,
    sourcePath: string,
    plugin: IronVaultPlugin,
    source: string,
    ctx: MarkdownPostProcessorContext,
  ) {
    super(containerEl);
    this.sourcePath = sourcePath;
    this.plugin = plugin;
    this.source = source;
    this.ctx = ctx;
  }

  render() {
    const [firstLine, inserted] = this.source.split("\n").filter((x) => x);
    if (inserted && inserted.trim().toLowerCase() === "inserted") {
      render(
        html`<article class="iron-vault-truth">
          <button type="button" @click=${() => this.reset()}>
            Reset Truth Picker
          </button>
        </article>`,
        this.containerEl,
      );
      return;
    }
    const truthName = firstLine.trim().toLowerCase();
    const truth = [...this.plugin.datastore.truths.values()].find((truth) => {
      return truth.name.toLowerCase() === truthName;
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
          <option
            disabled
            ?selected=${!this.selectedOptionSubIndex ||
            this.selectedOptionSubIndex < 0}
          >
            Select your option...
          </option>
          ${map(
            this.selectedOption.table.rows,
            (row, i) =>
              html`<option ?selected=${i === this.selectedOptionSubIndex}>
                ${row.text}
              </option>`,
          )}
        </select>
        <button
          type="button"
          @click=${() => {
            if (!this.selectedOption || !this.selectedOption.table) {
              return;
            }
            this.selectedOptionSubIndex = pickRandomSubOption(
              this.selectedOption.table!,
            );
            this.render();
          }}
          ${ref((el?: Element) => el && setIcon(el as HTMLElement, "dice"))}
        ></button>`;
    const tpl = html`
      <article class="iron-vault-truth">
        <select
          @change=${(e: Event) => {
            this.selectedOption =
              truth.options[(e.target as HTMLSelectElement).selectedIndex - 1];
            this.selectedOptionSubIndex = undefined;
            this.render();
          }}
        >
          <option disabled ?selected=${!this.selectedOption}>
            Select your truth...
          </option>
          ${map(
            truth.options,
            (option) => html`
              <option ?selected=${option === this.selectedOption}>
                ${md(this.plugin, option.summary ?? option.description)}
              </option>
            `,
          )}
        </select>
        <button
          type="button"
          @click=${() => {
            this.selectedOption = pickRandomOption(truth);
            this.selectedOptionSubIndex = undefined;
            this.render();
          }}
          ${ref((el?: Element) => el && setIcon(el as HTMLElement, "dice"))}
        ></button>
        <section>
          ${!this.selectedOption
            ? null
            : md(
                this.plugin,
                this.selectedOption.description
                  .replaceAll(/{{table:[^}]+}}/g, "")
                  .trim(),
              )}
          ${optionSelect ||
          html`<div></div>
            <div></div>`}
          ${this.selectedOption
            ? html`<button
                type="button"
                @click=${() => this.appendTruth()}
                ?disabled=${this.selectedOption.table &&
                this.selectedOptionSubIndex == null}
                ${ref(
                  (el?: Element) => el && setIcon(el as HTMLElement, "save"),
                )}
              ></button>`
            : null}
        </section>
      </article>
    `;
    render(tpl, this.containerEl);
  }

  appendTruth() {
    const editor = this.plugin.app.workspace.activeEditor?.editor;
    const sectionInfo = this.ctx.getSectionInfo(
      this.containerEl as HTMLElement,
    );
    if (
      !editor ||
      !sectionInfo ||
      !this.selectedOption ||
      (this.selectedOption.table &&
        !(
          this.selectedOptionSubIndex != null &&
          this.selectedOptionSubIndex >= 0
        ))
    ) {
      return;
    }
    const editorRange = {
      from: {
        ch: 0,
        line: sectionInfo.lineStart,
      },
      to: {
        ch: 0,
        line: sectionInfo.lineEnd,
      },
    };
    const text =
      this.selectedOption.table && this.selectedOptionSubIndex != null
        ? this.selectedOption.description.replaceAll(
            /{{table:[^}]+}}/g,
            this.selectedOption.table.rows[this.selectedOptionSubIndex].text,
          )
        : this.selectedOption.description;
    const to = {
      line: editorRange.to.line,
      ch: editor.getLine(editorRange.to.line).length,
    };
    editor.replaceRange(
      `\`\`\`iron-vault-truth\n${this.source}\ninserted\n\`\`\`\n${this.selectedOption.summary ? this.selectedOption.summary + "\n\n" : ""}${text}`,
      editorRange.from,
      to,
    );
  }

  reset() {
    const editor = this.plugin.app.workspace.activeEditor?.editor;
    const sectionInfo = this.ctx.getSectionInfo(
      this.containerEl as HTMLElement,
    );
    if (!editor || !sectionInfo) {
      return;
    }
    const editorRange = {
      from: {
        ch: 0,
        line: sectionInfo.lineStart,
      },
      to: {
        ch: 0,
        line: sectionInfo.lineEnd,
      },
    };
    const to = {
      line: editorRange.to.line,
      ch: editor.getLine(editorRange.to.line).length,
    };
    editor.replaceRange(
      `\`\`\`iron-vault-truth\n${this.source.split("\n").filter((x) => x)[0]}\n\`\`\`\n##### Old Truth:\n`,
      editorRange.from,
      to,
    );
  }
}

function pickRandomSubOption(table: {
  dice: string;
  rows: OracleTableRowText[];
}) {
  const dice = Dice.fromDiceString(table.dice);
  const res = dice.roll();
  return table.rows.findIndex((row) => row.min! <= res && res <= row.max!);
}

function pickRandomOption(truth: Truth) {
  const options = truth.options;
  if (options.every((option) => option.min != null && option.max != null)) {
    // Do a dice roll
    const die = Dice.fromDiceString(truth.dice);
    const res = die.roll();
    return options.find((opt) => opt.min! <= res && res <= opt.max!);
  } else {
    return options[Math.floor(Math.random() * options.length)];
  }
}
