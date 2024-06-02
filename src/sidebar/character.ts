import { render, html } from "lit-html";

import { activeCharacter } from "character-tracker";
import IronVaultPlugin from "index";
import { md } from "utils/ui/directives";
import { Component } from "obsidian";

export default function renderIronVaultCharacter(
  containerEl: HTMLElement,
  plugin: IronVaultPlugin,
  parent: Component,
) {
  const [charPath] = activeCharacter(plugin.characters);
  render(
    html`${md(plugin, `![[${charPath}|iv-embed]]`, ".", parent)}`,
    containerEl,
  );
}
