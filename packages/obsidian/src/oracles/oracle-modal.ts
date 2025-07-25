import IronVaultPlugin from "index";
import { Oracle, OracleGrouping, OracleGroupingType } from "model/oracle";
import { App, ButtonComponent, Component, MarkdownView, Modal } from "obsidian";
import { runOracleCommand } from "oracles/command";
import { generateOracleTable } from "./ui/oracle-table";

export class OracleModal extends Modal {
  modalComponent: Component;
  constructor(
    readonly app: App,
    readonly plugin: IronVaultPlugin,
    readonly oracle: Oracle,
  ) {
    super(app);
    this.modalComponent = new Component();
  }

  async openOracle(oracle: Oracle) {
    const { contentEl } = this;
    this.setTitle(oracle.name);
    contentEl.toggleClass("iron-vault-modal-content", true);
    contentEl.classList.toggle("iron-vault-oracle-modal", true);
    contentEl.toggleClass("iron-vault-modal", true);
    let ruleset: OracleGrouping = oracle.parent;
    while (
      oracle.parent &&
      ruleset.grouping_type !== OracleGroupingType.Ruleset
    ) {
      ruleset = ruleset.parent;
    }
    contentEl.createEl("header", { text: ruleset.name });
    const btn = new ButtonComponent(contentEl);
    btn
      .setIcon("dice")
      .setTooltip("Roll this oracle")
      .onClick(() => {
        const { workspace } = this.plugin.app;
        const view = workspace.getActiveFileView();
        if (view && view instanceof MarkdownView) {
          const editor = view.editor;
          runOracleCommand(this.plugin, editor, view, oracle);
          this.close();
        }
      });
    contentEl.appendChild(
      await generateOracleTable(this.app, oracle, this.modalComponent),
    );
  }

  onOpen() {
    this.modalComponent.load();
    this.openOracle(this.oracle);
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
    this.modalComponent.unload();
  }
}
