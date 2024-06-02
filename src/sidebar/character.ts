import { render, html } from "lit-html";

import { activeCharacter } from "character-tracker";
import IronVaultPlugin from "index";
import { md } from "utils/ui/directives";

export default function renderIronVaultCharacter(
  containerEl: HTMLElement,
  plugin: IronVaultPlugin,
) {
  const [charPath] = activeCharacter(plugin.characters);
  render(html`${md(plugin, `![[${charPath}|iv-embed]]`, ".")}`, containerEl);
}
