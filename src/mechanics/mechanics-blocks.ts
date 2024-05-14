import { parse } from "kdljs";

import ForgedPlugin from "../index";
import renderMove from "./move";
import { App, Component, MarkdownRenderer } from "obsidian";

export default function registerMechanicsBlock(plugin: ForgedPlugin): void {
  plugin.registerMarkdownCodeBlockProcessor(
    "mechanics",
    async (source, el, ctx) => {
      await parseMechanicsBlocks(
        plugin.app,
        source,
        el,
        ctx.sourcePath,
        plugin,
      );
    },
  );
}

async function parseMechanicsBlocks(
  app: App,
  source: string,
  el: HTMLElement,
  sourcePath: string,
  parent: Component,
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
        await renderMove(app, el, node, sourcePath, parent);
        break;
      }
      case "-": {
        const aside = el.createEl("aside", { cls: "forged-details" });
        await MarkdownRenderer.render(app, (node.values[0] as string).replaceAll(/^/g, "> "), aside, sourcePath, parent);
      }
    }
  }
}
