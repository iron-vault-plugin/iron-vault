import { ItemView, WorkspaceLeaf } from "obsidian";

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
    // container.createEl("h4", { text: "Forged" });
    const tabs = container.createEl("nav", { cls: "forged-sidebar-view tabs" });
    const oracleTab = tabs.createDiv({ cls: "tab" });
    oracleTab.createEl("input", {
      attr: {
        type: "radio",
        name: "tab-group",
        id: "oracle-tab",
        checked: "checked",
      },
    });
    oracleTab.createEl("label", {
      attr: { for: "oracle-tab" },
      text: "Oracles",
    });
    renderForgedOracles(
      oracleTab.createDiv({ cls: "content oracle-tab" }),
      this.plugin,
    );
    const moveTab = tabs.createDiv({ cls: "tab" });
    moveTab.createEl("input", {
      attr: {
        type: "radio",
        name: "tab-group",
        id: "move-tab",
      },
    });
    moveTab.createEl("label", {
      attr: { for: "move-tab" },
      text: "Moves",
    });
    renderForgedMoves(
      moveTab.createDiv({ cls: "content move-tab" }),
      this.plugin,
    );
  }

  async onClose() {
    // Nothing to clean up.
  }
}
