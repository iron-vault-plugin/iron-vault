import { parse } from "kdljs";

import ForgedPlugin from "../index";
import renderMove from "./move";

export default function registerMechanicsBlock(plugin: ForgedPlugin): void {
  plugin.registerMarkdownCodeBlockProcessor("mechanics", async (source, el) => {
    parseMechanicsBlocks(source, el);
  });
}

function parseMechanicsBlocks(source: string, el: HTMLElement) {
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
      case "move":
        renderMove(el, node);
        break;
    }
  }
}
