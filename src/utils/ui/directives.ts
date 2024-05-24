import IronVaultPlugin from "index";
import { MarkdownRenderChild, MarkdownRenderer } from "obsidian";
import { html } from "lit-html";
import { directive, Directive } from "lit-html/directive.js";

class RenderMarkdownDirective extends Directive {
  render(
    plugin: IronVaultPlugin,
    text: string,
    sourcePath: string = "",
  ): unknown {
    const target = document.createElement("div");
    target.classList.add("markdown-wrapper");
    MarkdownRenderer.render(
      plugin.app,
      text,
      target,
      sourcePath,
      new MarkdownRenderChild(target),
    );
    return html`${target}`;
  }
}

export const md = directive(RenderMarkdownDirective);
