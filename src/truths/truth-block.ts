import {
  EmbeddedOracleRollable,
  OracleRollableRowText,
  Truth,
  TruthOption,
} from "@datasworn/core/dist/Datasworn";
import { html, render } from "lit-html";
import { map } from "lit-html/directives/map.js";
import { ref } from "lit-html/directives/ref.js";
import {
  EventRef,
  MarkdownPostProcessorContext,
  MarkdownRenderChild,
  setIcon,
  TFile,
} from "obsidian";

import IronVaultPlugin from "index";
import { rootLogger } from "logger";
import { Dice, DieKind } from "utils/dice";
import { md } from "utils/ui/directives";

const logger = rootLogger.getLogger("truths.truth-block");

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
  sourceFile: TFile | null;
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
    this.sourceFile = plugin.app.vault.getFileByPath(sourcePath);
    this.plugin = plugin;
    this.source = source;
    this.ctx = ctx;
  }

  getSubOracle() {
    const subOracles = Object.values(this.selectedOption?.oracles ?? {});
    if (subOracles.length > 1) {
      // TODO: do we need to handle multiple truth suboracles?
      logger.warn(
        "Truth option %s has %d sub oracles, but expected at most one",
        this.selectedOption!._id,
        subOracles.length,
      );
    }

    return subOracles.first();
  }

  render() {
    const campaign =
      this.sourceFile &&
      this.plugin.campaignManager.campaignForFile(this.sourceFile);
    if (!campaign) {
      render(
        html`<article class="error">
          This file is not part of a campaign, but a campaign is needed for a
          truths block.
        </article>`,
        this.containerEl,
      );
      return;
    }
    const campaignContext =
      this.plugin.campaignManager.campaignContextFor(campaign);

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
    const truth =
      campaignContext.truths.get(truthName) ??
      [...campaignContext.truths.values()].find((truth) => {
        return truth.name.toLowerCase() === truthName;
      });
    if (!truth) {
      render(
        html`<article class="error">Truth not found: ${this.source}</article>`,
        this.containerEl,
      );
      return;
    }

    const subOracle = this.getSubOracle();
    const optionSelect =
      subOracle &&
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
            subOracle.rows,
            (row, i) =>
              html`<option ?selected=${i === this.selectedOptionSubIndex}>
                ${row.text}
              </option>`,
          )}
        </select>
        <button
          type="button"
          @click=${async () => {
            if (!this.selectedOption || !subOracle) {
              return;
            }
            this.selectedOptionSubIndex = await pickRandomSubOption(
              subOracle!,
              this.plugin,
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
          @click=${async () => {
            this.selectedOption = await pickRandomOption(truth, this.plugin);
            this.selectedOptionSubIndex = undefined;
            this.render();
          }}
          ${ref((el?: Element) => el && setIcon(el as HTMLElement, "dice"))}
        ></button>
        <section>
          ${!this.selectedOption ? null : this.selectedOption.summary}
          ${!this.selectedOption
            ? null
            : md(
                this.plugin,
                this.selectedOption.description
                  .replaceAll(/{{table>[^}]+}}/g, "")
                  .trim(),
              )}
          ${optionSelect ||
          html`<div></div>
            <div></div>`}
          ${this.selectedOption
            ? html`<button
                type="button"
                @click=${() => this.appendTruth()}
                ?disabled=${subOracle && this.selectedOptionSubIndex == null}
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
    let subOracle: EmbeddedOracleRollable | undefined = undefined;
    if (
      !editor ||
      !sectionInfo ||
      !this.selectedOption ||
      ((subOracle = this.getSubOracle()) &&
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
      subOracle && this.selectedOptionSubIndex != null
        ? this.selectedOption.description.replaceAll(
            /{{table>[^}]+}}/g,
            subOracle.rows[this.selectedOptionSubIndex].text,
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
    editor.focus();
    editor.setCursor({ ch: 0, line: to.line + 2 });
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
    editor.focus();
    editor.setCursor({ ch: 0, line: to.line + 2 });
  }
}

async function pickRandomSubOption(
  table: {
    dice: string;
    rows: OracleRollableRowText[];
  },
  plugin: IronVaultPlugin,
) {
  const dice = Dice.fromDiceString(table.dice, plugin, DieKind.Oracle);
  const res = await dice.roll(plugin.settings.graphicalOracleDice);
  return table.rows.findIndex(
    (row) => row.roll!.min <= res && res <= row.roll!.max,
  );
}

async function pickRandomOption(truth: Truth, plugin: IronVaultPlugin) {
  const options = truth.options;
  if (options.every((option) => option.roll != null)) {
    // Do a dice roll
    const die = Dice.fromDiceString(truth.dice, plugin, DieKind.Oracle);
    const res = await die.roll(plugin.settings.graphicalOracleDice);
    return options.find((opt) => opt.roll.min <= res && res <= opt.roll.max);
  } else {
    return options[Math.floor(Math.random() * options.length)];
  }
}
