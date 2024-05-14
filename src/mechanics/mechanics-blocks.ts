import { parse } from "kdljs";
import { MarkdownRenderChild, MarkdownRenderer } from "obsidian";

import ForgedPlugin from "../index";
import renderMove from "./move";

export default function registerMechanicsBlock(plugin: ForgedPlugin): void {
  plugin.registerMarkdownCodeBlockProcessor(
    "mechanics",
    async (source, el, ctx) => {
      await parseMechanicsBlocks(plugin, source, el, ctx.sourcePath);
    },
  );
}

async function parseMechanicsBlocks(
  plugin: ForgedPlugin,
  source: string,
  el: HTMLElement,
  sourcePath: string,
) {
  const res = parse(source);
  if (!res.output) {
    // TODO: give line/column information for errors.
    el.createEl("pre", {
      text: `Error parsing mechanics block: KDL text was invalid.\nSee https://kdl.dev for syntax.`,
    });
    return;
  }
  const doc = res.output;
  for (const node of doc) {
    switch (node.name.toLowerCase()) {
      case "move": {
        await renderMove(plugin, el, node, sourcePath);
        break;
      }
      case "-": {
        const aside = el.createEl("aside", { cls: "forged-details" });
        await MarkdownRenderer.render(
          plugin.app,
          (node.values[0] as string).replaceAll(/^/g, "> "),
          aside,
          sourcePath,
          new MarkdownRenderChild(aside),
        );
        break;
      }
    }
  }
}
