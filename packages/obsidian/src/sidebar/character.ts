import { html, render } from "lit-html";

import { CampaignDependentBlockRenderer } from "campaigns/campaign-source";
import { CampaignDataContext } from "campaigns/context";
import IronVaultPlugin from "index";
import { md } from "utils/ui/directives";
import { CharacterSelectComponent } from "utils/ui/settings/character-select";

export class CharacterRenderer extends CampaignDependentBlockRenderer {
  characterSelect: CharacterSelectComponent;
  characterSheetEl: HTMLElement;
  characterPath: string | undefined;

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

    this.characterSelect = new CharacterSelectComponent(containerEl, plugin)
      .allowEmpty(false)
      .defaultToActiveCharacter(true)
      .onChange((character) => {
        this.characterPath = character;
        this.triggerUpdate();
      });
    this.characterSheetEl = containerEl.createDiv({
      cls: "iron-vault-character-sheet",
    });
  }

  protected override onNewContext(
    _context: CampaignDataContext | undefined,
  ): void {
    this.characterSelect.setCampaignContext(_context);
  }

  override renderWithoutContext(): void | Promise<void> {
    render(html`<p>No active campaign.</p>`, this.characterSheetEl);
  }

  render() {
    if (!this.characterPath) {
      render(
        html`<p>No active character for campaign '${this.campaign.name}'</p>`,
        this.characterSheetEl,
      );
      return;
    }
    render(
      html`${md(
        this.plugin,
        `![[${this.characterPath}|iv-embed]]`,
        this.sourcePath,
        this,
      )}`,
      this.characterSheetEl,
    );
  }
}
