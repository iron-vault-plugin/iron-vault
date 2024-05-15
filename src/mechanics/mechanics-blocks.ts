import { parse } from "kdljs";
import { MarkdownRenderChild, MarkdownRenderer } from "obsidian";

import ForgedPlugin from "../index";
import renderMove from "./move";

export default function registerMechanicsBlock(plugin: ForgedPlugin): void {
  plugin.registerMarkdownCodeBlockProcessor(
    "mechanics",
    async (source, el, ctx) => {
      // We can't render blocks until datastore is ready.
      await plugin.datastore.waitForReady;
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
  let details: string[] = [];
  for (const node of doc) {
    const name = node.name.toLowerCase();
    if (details.length && name !== "-") {
      await renderDetails();
      details = [];
    }
    switch (node.name.toLowerCase()) {
      case "move": {
        await renderMove(plugin, el, node, sourcePath);
        break;
      }
      case "-": {
        details.push(...(node.values[0] as string).split("\n"));
        break;
      }
    }
  }
  if (details.length) {
    await renderDetails();
  }
  async function renderDetails() {
    const aside = el.createEl("aside", { cls: "forged-details" });
    await MarkdownRenderer.render(
      plugin.app,
      "> " + details.join("\n> "),
      aside,
      sourcePath,
      new MarkdownRenderChild(aside),
    );
  }
}
