import { ItemView, WorkspaceLeaf } from "obsidian";

import ForgedPlugin from "index";
import renderForgedOracles from "./oracles";

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
    container.createEl("h4", { text: "Forged" });
    const tabs = container.createEl("nav", { cls: "forged-sidebar-view" });
    renderForgedOracles(tabs, this.plugin);
  }

  async onClose() {
    // Nothing to clean up.
  }
}
