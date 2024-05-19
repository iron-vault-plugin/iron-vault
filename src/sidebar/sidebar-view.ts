import { ItemView, WorkspaceLeaf } from "obsidian";
import { render, html } from "lit-html";

import ForgedPlugin from "index";
import renderForgedOracles from "./oracles";
import renderForgedMoves from "./moves";

export const VIEW_TYPE = "forged-sidebar-view";

export class SidebarView extends ItemView {
  plugin: ForgedPlugin;

  constructor(leaf: WorkspaceLeaf, plugin: ForgedPlugin) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType() {
    return VIEW_TYPE;
  }

  getDisplayText() {
    return "Forged";
  }

  getIcon() {
    return "dice";
  }

  async onOpen() {
    const container = this.containerEl.children[1];
    container.empty();
    const tpl = html`
      <nav class="forged-sidebar-view tabs">
        <div class="tab">
          <input type="radio" name="tab-group" id="oracle-tab" checked />
          <label for="oracle-tab">Oracles</label>
          <div class="content oracle-tab"></div>
        </div>
        <div class="tab">
          <input type="radio" name="tab-group" id="move-tab" />
          <label for="move-tab">Moves</label>
          <div class="content move-tab"></div>
        </div>
      </nav>
    `;
    render(tpl, container as HTMLElement);
    // We separate these out so they can do their own dynamic state stuff.
    renderForgedOracles(
      container.querySelector(".content.oracle-tab")!,
      this.plugin,
    );
    renderForgedMoves(
      container.querySelector(".content.move-tab")!,
      this.plugin,
    );
  }

  async onClose() {
    // Nothing to clean up.
  }
}
