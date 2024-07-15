import IronVaultPlugin from "index";
import {
  Component,
  MarkdownPreviewView,
  MarkdownRenderChild,
  Setting,
} from "obsidian";
import { html } from "lit-html";
import { directive, Directive } from "lit-html/directive.js";

class RenderMarkdownDirective extends Directive {
  render(
    plugin: IronVaultPlugin,
    text: string,
    sourcePath: string = "",
    parent?: Component,
  ): unknown {
    const target = document.createElement("div");
    target.classList.add("markdown-wrapper");
    MarkdownPreviewView.render(
      plugin.app,
      text,
      target,
      sourcePath,
      parent ?? new MarkdownRenderChild(target),
    );
    return html`${target}`;
  }
}

export const md = directive(RenderMarkdownDirective);

class SettingDirective extends Directive {
  render(cb: (s: Setting) => void) {
    const wrapper = document.createElement("div");
    const setting = new Setting(wrapper);
    cb(setting);
    return html`${setting.settingEl}`;
  }
}

export const setting = directive(SettingDirective);
