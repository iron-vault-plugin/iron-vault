import ForgedPlugin from "index";
import { Oracle, OracleRulesetGrouping } from "model/oracle";
import { App, ButtonComponent, MarkdownView, Modal } from "obsidian";
import { runOracleCommand } from "oracles/command";

export default async function renderForgedOracles(
  cont: Element,
  plugin: ForgedPlugin,
) {
  const loading = cont.createEl("p", { text: "Loading data..." });
  await plugin.datastore.waitForReady;
  loading.remove();
  renderOracleList(cont, plugin);
}

function renderOracleList(cont: Element, plugin: ForgedPlugin) {
  const oracles = plugin.datastore.oracles;
  const list = cont.createEl("ol", { cls: "oracles-list" });
  const rulesets: Map<string, HTMLElement> = new Map();
  const groupings: Map<string, HTMLElement> = new Map();
  for (const oracle of oracles.values()) {
    let topGroup = oracle.parent;
    let groupName = topGroup.name;
    while (
      topGroup &&
      topGroup.grouping_type === "collection" &&
      topGroup.parent.grouping_type === "collection"
    ) {
      topGroup = topGroup.parent;
      groupName = `${topGroup.name} > ${groupName}`;
    }

    const ruleset =
      topGroup.grouping_type === "collection"
        ? topGroup.parent
        : ({
            name: "Homebrew",
            id: "forged_homebrew",
          } as OracleRulesetGrouping);

    let rulesetEl = rulesets.get(ruleset.id);
    if (!rulesetEl) {
      const li = list.createEl("li", { cls: "ruleset" });
      const wrapper = li.createDiv("wrapper");
      const details = wrapper.createEl("details");
      details.setAttribute("open", "open");
      details.createEl("summary").createEl("span", { text: ruleset.name });
      rulesetEl = wrapper.createEl("ol", { cls: "content" });
      rulesets.set(ruleset.id, rulesetEl);
    }

    let groupingEl = groupings.get(groupName);
    if (!groupingEl) {
      const li = rulesetEl.createEl("li", { cls: "oracle-group" });
      groupingEl = li.createDiv("wrapper");
      const details = li.createEl("details");
      details.createEl("summary").createEl("span", { text: groupName });
      groupingEl = li.createEl("ul", { cls: "content" });
      groupings.set(groupName, groupingEl);
      new ButtonComponent(groupingEl)
        .setButtonText("Roll All")
        .setTooltip("Roll all oracles in this group as a single batch.")
        .onClick(() => {
          console.log("TODO: Roll oracle batch");
        });
    }
    const li = groupingEl.createEl("li");
    li.addEventListener("click", (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      const { workspace } = plugin.app;
      const editor = workspace.activeEditor?.editor;
      const view = workspace.getActiveViewOfType(MarkdownView);
      console.log({ editor, view });
      if (editor && view) {
        runOracleCommand(plugin.app, plugin.datastore, editor, view);
      }
    });
    li.createEl("span", { text: oracle.name });
    const modal = new OracleModal(plugin.app, plugin, oracle);
    const btn = new ButtonComponent(li);
    btn
      .setIcon("list")
      .setTooltip("View Oracle Details")
      .onClick(() => modal.open());
  }
}

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
