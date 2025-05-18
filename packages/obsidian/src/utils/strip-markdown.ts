import IronVaultPlugin from "index";
import { MarkdownRenderChild, MarkdownRenderer } from "obsidian";

export function stripMarkdown(plugin: IronVaultPlugin, md: string) {
  const el = document.createElement("div");
  MarkdownRenderer.render(plugin.app, md, el, ".", new MarkdownRenderChild(el));
  return el.innerText;
}
