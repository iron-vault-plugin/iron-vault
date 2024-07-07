import { type Datastore } from "datastore";
import {
  MarkdownRenderChild,
  MarkdownRenderer,
  MarkdownView,
  parseYaml,
  stringifyYaml,
  type App,
  type MarkdownPostProcessorContext,
} from "obsidian";
import { Oracle, OracleGroupingType } from "../model/oracle";
import { RollWrapper } from "../model/rolls";
import { OracleRoller } from "./roller";
import { oracleSchema, type OracleSchema, type RollSchema } from "./schema";
import IronVaultPlugin from "index";
import { Datasworn } from "@datasworn/core";

export function registerOracleBlock(plugin: IronVaultPlugin): void {
  plugin.registerMarkdownCodeBlockProcessor(
    "oracle",
    async (source, el, ctx) => {
      const doc = parseYaml(source);
      const validatedOracle = oracleSchema.safeParse(doc);

      if (validatedOracle.success) {
        const renderer = new OracleMarkdownRenderChild(
          el,
          plugin.app,
          ctx,
          plugin.datastore,
          validatedOracle.data,
        );
        ctx.addChild(renderer);
        renderer.render();
      } else {
        el.createEl("pre", {
          text:
            "Error parsing oracle result\n" +
            JSON.stringify(validatedOracle.error.format()),
        });
      }
    },
  );
}

// function renderRoll(roll: Roll): string {
//   switch (roll.kind) {
//     case "multi":
//       return `(${roll.roll} on ${roll.table.Title.Standard} -> ${
//         roll.row.Result
//       }): ${roll.results.map((r) => renderRoll(r)).join(", ")}`;
//     case "simple":
//       return `(${roll.roll} on ${roll.table.Title.Standard}) ${roll.row.Result}`;
//     case "templated":
//       return `(${roll.roll} on ${roll.table.Title.Standard}) ${roll.row[
//         "Roll template"
//       ]?.Result?.replace(/\{\{([^{}]+)\}\}/g, (_match, id) => {
//         // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
//         return renderRoll(roll.templateRolls.get(id)!);
//       })}`;
//     default: {
//       const _exhaustiveCheck: never = roll;
//       return _exhaustiveCheck;
//     }
//   }
// }

function renderDetails(roll: RollSchema): string {
  let result = `${roll.tableName} (${roll.roll}: ${
    roll.raw ?? roll.results[0]
  })`;
  const subrolls = roll.subrolls ?? [];
  if (subrolls.length > 0) {
    result += ` -> (${subrolls.map(renderDetails).join(", ")})`;
  }
  return result;
}

export function renderRollPath(roll: RollSchema): string {
  let result = `${roll.tableId}:${roll.roll}`;
  const subrolls = roll.subrolls ?? [];
  if (subrolls.length > 0) {
    result += `(${subrolls.map(renderRollPath).join(",")})`;
  }
  return result;
}

export function oracleNameWithParents(oracle: Oracle): string {
  const steps = [oracle.name];
  let next = oracle.parent;
  while (next && next.grouping_type != OracleGroupingType.Ruleset) {
    steps.unshift(next.name);
    next = next.parent;
  }
  return steps.join(" / ");
}

export function renderOracleCallout(
  question: string | undefined,
  rollWrapper: RollWrapper,
): string {
  const roll = rollWrapper.dehydrate();
  return `> [!oracle] ${question ?? "Ask the Oracle"} (${oracleNameWithParents(
    rollWrapper.oracle,
  )}): ${roll.results.join("; ")} %%${renderRollPath(roll)}%%\n>\n\n`;
}

export function renderDetailedOracleCallout(oracle: OracleSchema): string {
  const { roll, question } = oracle;
  return `> [!oracle] ${question ?? "Ask the Oracle"}: ${roll.results.join(
    "; ",
  )}\n> ${renderDetails(roll)}\n\n`;
}

class OracleMarkdownRenderChild extends MarkdownRenderChild {
  protected _renderEl?: HTMLElement;

  constructor(
    containerEl: HTMLElement,
    protected readonly app: App,
    protected readonly ctx: MarkdownPostProcessorContext,
    protected readonly datastore: Datastore,
    protected readonly oracle: OracleSchema,
  ) {
    super(containerEl);
  }

  template(): string {
    return renderDetailedOracleCallout(this.oracle);
  }

  async render(): Promise<void> {
    this._renderEl!.replaceChildren();
    await MarkdownRenderer.render(
      this.app,
      this.template(),
      this._renderEl!,
      this.ctx.sourcePath,
      this,
    );
  }

  async onload(): Promise<void> {
    const div = this.containerEl.createDiv();
    const button = div.createEl("button", { type: "button", text: "Re-roll" });
    // TODO: only render actions if we are in edit-only mode
    button.onClickEvent(async (_ev) => {
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
        const result = await new OracleRoller(oracles).roll(
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          oracles.get(this.oracle.roll.tableId)!,
        );

        editor.replaceRange(
          "\n\n" + formatOracleBlock({ roll: result }),
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
      this.app.metadataCache.on("iron-vault:index-changed", async () => {
        await this.render();
      }),
    );
  }
}

export function formatOracleBlock({
  question,
  roll,
}: {
  question?: string;
  roll: RollWrapper;
}): string {
  const oracle: OracleSchema = {
    question,
    roll: roll.dehydrate(),
  };
  return `\`\`\`oracle\n${stringifyYaml(oracle)}\`\`\`\n\n`;
}

export async function generateOracleTable(
  plugin: IronVaultPlugin,
  oracle: Oracle,
): Promise<HTMLTableElement> {
  const table = document.createElement("table");
  table.toggleClass("iron-vault-oracle-table", true);
  const oracleDesc = oracle.raw;
  let numColumns: number = 1;
  if (
    oracleDesc.oracle_type == "table_text2" ||
    oracleDesc.oracle_type == "column_text2"
  ) {
    numColumns = 2;
  } else if (
    oracleDesc.oracle_type == "table_text3" ||
    oracleDesc.oracle_type == "column_text3"
  ) {
    numColumns = 3;
  }

  if ("column_labels" in oracleDesc) {
    const thead = table.createEl("thead");
    const tr = thead.createEl("tr");
    tr.createEl("th", { text: oracleDesc.column_labels.roll });
    tr.createEl("th", { text: oracleDesc.column_labels.text });
    if (numColumns >= 2) {
      tr.createEl("th", {
        text: (oracleDesc as Datasworn.OracleTableText2).column_labels.text2,
      });
    }
    if (numColumns >= 3) {
      tr.createEl("th", {
        text: (oracleDesc as Datasworn.OracleTableText3).column_labels.text3,
      });
    }
  }
  const body = table.createEl("tbody");
  for (const row of oracleDesc.rows) {
    const tr = body.createEl("tr");
    let rangeText;
    if (!row.roll) {
      rangeText = "";
    } else if (row.roll.min === row.roll.max) {
      rangeText = "" + row.roll.min;
    } else {
      rangeText = `${row.roll.min} - ${row.roll.max}`;
    }
    tr.createEl("td", { text: rangeText });
    const td = tr.createEl("td");
    await renderMarkdown(plugin, td, row.text);
    if (numColumns >= 2) {
      const td = tr.createEl("td");
      await renderMarkdown(
        plugin,
        td,
        (row as Datasworn.OracleRollableRowText2).text2 ?? "",
      );
    }
    if (numColumns >= 3) {
      const td = tr.createEl("td");
      await renderMarkdown(
        plugin,
        td,
        (row as Datasworn.OracleRollableRowText3).text3 ?? "",
      );
    }
  }
  return table;
}

async function renderMarkdown(
  plugin: IronVaultPlugin,
  target: HTMLElement,
  md: string,
) {
  await MarkdownRenderer.render(
    plugin.app,
    md,
    target,
    "",
    new MarkdownRenderChild(target),
  );
}
