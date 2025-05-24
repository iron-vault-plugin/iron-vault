import { html, render } from "lit-html";

import { CampaignDependentBlockRenderer } from "campaigns/campaign-source";
import { CharacterActionContext } from "characters/action-context";
import IronVaultPlugin from "index";
import { md } from "utils/ui/directives";

export class CharacterRenderer extends CampaignDependentBlockRenderer {
  constructor(
    containerEl: HTMLElement,
    plugin: IronVaultPlugin,
    sourcePath?: string,
  ) {
    super(containerEl, plugin, sourcePath, {
      watchDataIndex: true,
      debouncePeriod: 100,
      watchActiveCharacter: true,
    });
  }

  onload(): void {
    super.onload();

    console.log("CharacterRenderer: onload");
  }

  renderWithoutContext(): void | Promise<void> {
    render(html`<p>No active campaign.</p>`, this.containerEl);
  }

  render() {
    const context = this.actionContext;
    if (!(context instanceof CharacterActionContext)) {
      render(
        html`<p>No active character for campaign '${this.campaign.name}'</p>`,
        this.containerEl,
      );
      return;
    }
    render(
      html`${md(
        this.plugin,
        `![[${context.characterPath}|iv-embed]]`,
        this.sourcePath,
        this,
      )}`,
      this.containerEl,
    );
  }
}
