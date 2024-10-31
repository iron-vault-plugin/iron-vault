import { html, render } from "lit-html";

import {
  currentActiveCharacterForCampaign,
  MissingCharacterError,
} from "character-tracker";
import IronVaultPlugin from "index";
import { Component } from "obsidian";
import { md } from "utils/ui/directives";

export default async function renderIronVaultCharacter(
  containerEl: HTMLElement,
  plugin: IronVaultPlugin,
  parent: Component,
) {
  try {
    const campaign = plugin.campaignManager.lastActiveCampaign();
    if (!campaign) {
      render(html`<p>No active campaign.</p>`, containerEl);
      return;
    }
    const context = currentActiveCharacterForCampaign(
      plugin,
      plugin.campaignManager.campaignContextFor(campaign),
    );
    if (!context) {
      render(
        html`<p>No active character for campaign '${campaign.name}'</p>`,
        containerEl,
      );
      return;
    }
    render(
      html`${md(
        plugin,
        `![[${context.characterPath}|iv-embed]]`,
        ".",
        parent,
      )}`,
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
