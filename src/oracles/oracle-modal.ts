import ForgedPlugin from "index";
import { Oracle } from "model/oracle";
import { App, ButtonComponent, MarkdownView, Modal } from "obsidian";
import { runOracleCommand } from "oracles/command";

export class OracleModal extends Modal {
  plugin: ForgedPlugin;
  oracle: Oracle;

  constructor(app: App, plugin: ForgedPlugin, oracle: Oracle) {
    super(app);
    this.plugin = plugin;
    this.oracle = oracle;
  }

  openOracle(oracle: Oracle) {
    const { contentEl } = this;
    this.setTitle(oracle.name);
    contentEl.classList.toggle("forged-oracle-modal", true);
    (async () => {
      const btn = new ButtonComponent(contentEl);
      btn
        .setIcon("dice")
        .setTooltip("Roll this Oracle")
        .onClick(() => {
          const { workspace } = this.plugin.app;
          const editor = workspace.activeEditor?.editor;
          const view = workspace.getActiveViewOfType(MarkdownView);
          console.log({ editor, view });
          if (editor && view) {
            runOracleCommand(
              this.plugin.app,
              this.plugin.datastore,
              editor,
              view,
            );
          }
        });
      const table = contentEl.createEl("table");
      for (const row of oracle.rollableRows) {
        const tr = table.createEl("tr");
        let rangeText;
        if (!row.range) {
          rangeText = "";
        } else if (row.range.min === row.range.max) {
          rangeText = "" + row.range.min;
        } else {
          rangeText = `${row.range.min} - ${row.range.max}`;
        }
        tr.createEl("td", { text: rangeText });
        tr.createEl("td", { text: row.result });
      }
      for (const child of contentEl.querySelectorAll('a[href^="id:"]')) {
        child.addEventListener("click", (ev) => {
          const id = child.getAttribute("href")?.slice(3);
          ev.preventDefault();
          const oracle = id ? this.plugin.datastore.oracles.get(id) : undefined;
          if (oracle) {
            contentEl.empty();
            this.openOracle(oracle);
          }
        });
      }
    })();
  }

  onOpen() {
    this.openOracle(this.oracle);
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}
