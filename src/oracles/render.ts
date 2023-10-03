import { type Datastore } from "datastore";
import {
  MarkdownRenderChild,
  MarkdownRenderer,
  MarkdownView,
  parseYaml,
  stringifyYaml,
  type App,
  type MarkdownPostProcessorContext,
  type Plugin,
} from "obsidian";
import { OracleRoller, dehydrateRoll, hydrateRoll } from "./rolls";
import { rollSchema, type Roll, type RollSchema } from "./schema";
import { formatOraclePath } from "./utils";

export function registerOracleBlock(
  plugin: Plugin,
  datastore: Datastore,
): void {
  plugin.registerMarkdownCodeBlockProcessor(
    "oracle",
    async (source, el, ctx) => {
      const doc = parseYaml(source);
      const validatedRoll = rollSchema.safeParse(doc);

      if (validatedRoll.success) {
        ctx.addChild(
          new OracleMarkdownRenderChild(
            el,
            plugin.app,
            ctx,
            datastore,
            validatedRoll.data,
          ),
        );
      } else {
        el.createEl("pre", {
          text:
            "Error parsing roll\n" +
            JSON.stringify(validatedRoll.error.format()),
        });
      }
    },
  );
}

function renderRoll(roll: Roll): string {
  switch (roll.kind) {
    case "multi":
      return `(${roll.roll} on ${roll.table.Title.Standard} -> ${
        roll.row.Result
      }): ${roll.results.map((r) => renderRoll(r)).join(", ")}`;
    case "simple":
      return `(${roll.roll} on ${roll.table.Title.Standard}) ${roll.row.Result}`;
    case "templated":
      return `(${roll.roll} on ${roll.table.Title.Standard}) ${roll.row[
        "Roll template"
      ]?.Result?.replace(/\{\{([^{}]+)\}\}/g, (_match, id) => {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        return renderRoll(roll.templateRolls.get(id)!);
      })}`;
    default: {
      const _exhaustiveCheck: never = roll;
      return _exhaustiveCheck;
    }
  }
}

class OracleMarkdownRenderChild extends MarkdownRenderChild {
  protected _renderEl: HTMLElement;

  constructor(
    containerEl: HTMLElement,
    protected readonly app: App,
    protected readonly ctx: MarkdownPostProcessorContext,
    protected readonly datastore: Datastore,
    protected readonly roll: RollSchema,
  ) {
    super(containerEl);
  }

  template(): string {
    const index = this.datastore.oracles;
    const result = hydrateRoll(index, this.roll);
    return `> [!oracle] Oracle: ${formatOraclePath(
      index,
      result.table,
    )}: ${renderRoll(result)}\n\n`;
  }

  async render(): Promise<void> {
    await MarkdownRenderer.render(
      this.app,
      this.template(),
      this._renderEl,
      this.ctx.sourcePath,
      this,
    );
  }

  async onload(): Promise<void> {
    const div = this.containerEl.createDiv();
    const button = div.createEl("button", { type: "button", text: "Re-roll" });
    button.onClickEvent((_ev) => {
      const view = this.app.workspace.getActiveViewOfType(MarkdownView);
      if (this.ctx.sourcePath !== view?.file?.path) {
        throw new Error(
          `ctx path ${this.ctx.sourcePath} that doesn't match view path ${view?.file?.path}`,
        );
      }

      const sectionInfo = this.ctx.getSectionInfo(this.containerEl);
      if (view?.editor != null && sectionInfo != null) {
        const editor = view.editor;

        const oracles = this.datastore.oracles;
        const result = new OracleRoller(oracles).roll(
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          oracles.getTable(this.roll.table)!,
        );

        editor.replaceRange(
          `\n\n\`\`\`oracle\n${stringifyYaml(dehydrateRoll(result))}\`\`\`\n\n`,
          { line: sectionInfo.lineEnd + 1, ch: 0 },
          { line: sectionInfo.lineEnd + 1, ch: 0 },
        );
      }
    });
    this._renderEl = this.containerEl.createDiv();

    if (this.datastore.ready) {
      await this.render();
    }
    this.registerEvent(
      this.app.metadataCache.on("forged:index-changed", async () => {
        await this.render();
      }),
    );
  }
}
