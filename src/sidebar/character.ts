import { html, render } from "lit-html";

import { activeCharacter, MissingCharacterError } from "character-tracker";
import IronVaultPlugin from "index";
import { Component } from "obsidian";
import { md } from "utils/ui/directives";

export default async function renderIronVaultCharacter(
  containerEl: HTMLElement,
  plugin: IronVaultPlugin,
  parent: Component,
) {
  try {
    // TODO(@cwegrzyn): this needs to be fixed
    const [charPath] = await activeCharacter(plugin, undefined as never);
    render(
      html`${md(plugin, `![[${charPath}|iv-embed]]`, ".", parent)}`,
      containerEl,
    );
  } catch (e) {
    if (e instanceof MissingCharacterError) {
      render(
        html`<p>${e.message}</p>
          <p></p>`,
        containerEl,
      );
    } else {
      render(
        html`<p>Unexpected error when loading character:</p>
          <pre>${e}</pre>`,
        containerEl,
      );
    }
  }
}
