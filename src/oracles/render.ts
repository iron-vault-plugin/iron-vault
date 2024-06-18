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
