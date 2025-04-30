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
    });
  }

  onload(): void {
    super.onload();

    console.log("CharacterRenderer: onload");
    this.registerEvent(
      this.plugin.campaignManager.on(
        "active-campaign-settings-changed",
        ({ key }) => {
          if (key === "activeCharacter") {
            console.debug(
              "active character changed, updating character renderer",
            );
            this.triggerUpdate();
          }
        },
      ),
    );

    this.registerEvent(
      // TODO: probably this should be limited to just the current character, although
      // how often would we change the non-active character?
      this.plugin.characters.on("changed", this.triggerUpdate.bind(this)),
    );
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
