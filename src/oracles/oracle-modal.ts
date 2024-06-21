import { Datasworn } from "@datasworn/core";
import IronVaultPlugin from "index";
import { Oracle } from "model/oracle";
import {
  App,
  ButtonComponent,
  MarkdownRenderChild,
  MarkdownRenderer,
  MarkdownView,
  Modal,
} from "obsidian";
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
    this.setTitle(oracle.name);
    contentEl.toggleClass("iron-vault-modal-content", true);
    contentEl.classList.toggle("iron-vault-oracle-modal", true);
    contentEl.toggleClass("iron-vault-modal", true);
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
            runOracleCommand(this.plugin, editor, view, oracle);
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
        if (!row.roll) {
          rangeText = "";
        } else if (row.roll.min === row.roll.max) {
          rangeText = "" + row.roll.min;
        } else {
          rangeText = `${row.roll.min} - ${row.roll.max}`;
        }
        tr.createEl("td", { text: rangeText });
        const td = tr.createEl("td");
        this.renderMarkdown(td, row.text);
        if (numColumns >= 2) {
          const td = tr.createEl("td");
          this.renderMarkdown(
            td,
            (row as Datasworn.OracleRollableRowText2).text2 ?? "",
          );
        }
        if (numColumns >= 3) {
          const td = tr.createEl("td");
          this.renderMarkdown(
            td,
            (row as Datasworn.OracleRollableRowText3).text3 ?? "",
          );
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
  async renderMarkdown(target: HTMLElement, md: string) {
    await MarkdownRenderer.render(
      this.plugin.app,
      md,
      target,
      "",
      new MarkdownRenderChild(target),
    );
  }
}
