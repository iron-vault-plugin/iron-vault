import { Datasworn } from "@datasworn/core";
import IronVaultPlugin from "index";
import { Oracle } from "model/oracle";
import { App, ButtonComponent, MarkdownView, Modal } from "obsidian";
import { runOracleCommand } from "oracles/command";

export class OracleModal extends Modal {
  plugin: IronVaultPlugin;
  oracle: Oracle;

  constructor(app: App, plugin: IronVaultPlugin, oracle: Oracle) {
    super(app);
    this.plugin = plugin;
    this.oracle = oracle;
  }

  openOracle(oracle: Oracle) {
    const { contentEl } = this;
    contentEl.toggleClass("iron-vault-modal-content", true);
    this.setTitle(oracle.name);
    contentEl.classList.toggle("iron-vault-oracle-modal", true);
    (async () => {
      const btn = new ButtonComponent(contentEl);
      btn
        .setIcon("dice")
        .setTooltip("Roll this Oracle")
        .onClick(() => {
          const { workspace } = this.plugin.app;
          const view = workspace.getActiveFileView();
          if (view && view instanceof MarkdownView) {
            const editor = view.editor;
            runOracleCommand(
              this.plugin.app,
              this.plugin.datastore,
              editor,
              view,
              oracle,
            );
            this.close();
          }
        });
      const table = contentEl.createEl("table");
      const oracleDesc = oracle.raw;
      let numColumns: number = 1;
      if (
        oracleDesc.oracle_type == "table_text2" ||
        oracleDesc.oracle_type == "column_text2"
      ) {
        numColumns = 2;
      } else if (
        oracleDesc.oracle_type == "table_text3" ||
        oracleDesc.oracle_type == "column_text3"
      ) {
        numColumns = 3;
      }

      if ("column_labels" in oracleDesc) {
        const thead = table.createEl("thead");
        const tr = thead.createEl("tr");
        tr.createEl("th", { text: oracleDesc.column_labels.roll });
        tr.createEl("th", { text: oracleDesc.column_labels.text });
        if (numColumns >= 2) {
          tr.createEl("th", {
            text: (oracleDesc as Datasworn.OracleTableText2).column_labels
              .text2,
          });
        }
        if (numColumns >= 3) {
          tr.createEl("th", {
            text: (oracleDesc as Datasworn.OracleTableText3).column_labels
              .text3,
          });
        }
      }
      for (const row of oracleDesc.rows) {
        const tr = table.createEl("tr");
        let rangeText;
        if (!row.min || !row.max) {
          rangeText = "";
        } else if (row.min === row.max) {
          rangeText = "" + row.min;
        } else {
          rangeText = `${row.min} - ${row.max}`;
        }
        tr.createEl("td", { text: rangeText });
        tr.createEl("td", { text: row.text });
        if (numColumns >= 2) {
          tr.createEl("td", {
            text: (row as Datasworn.OracleTableRowText2).text2 ?? "",
          });
        }
        if (numColumns >= 3) {
          tr.createEl("td", {
            text: (row as Datasworn.OracleTableRowText3).text3 ?? "",
          });
        }
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
