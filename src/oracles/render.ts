import { Datasworn } from "@datasworn/core";
import { App, Component, MarkdownRenderer } from "obsidian";
import { Oracle, OracleGrouping, OracleGroupingType } from "../model/oracle";

export function oracleNameWithParents(oracle: Oracle): string {
  const steps = [oracle.name];
  let next: OracleGrouping = oracle.parent;
  while (next && next.grouping_type != OracleGroupingType.Ruleset) {
    steps.unshift(next.name);
    next = next.parent;
  }
  return steps.join(" / ");
}

export async function generateOracleTable(
  app: App,
  oracle: Oracle,
  component: Component,
): Promise<HTMLTableElement> {
  const table = document.createElement("table");
  table.toggleClass("iron-vault-oracle-table", true);
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
        text: (oracleDesc as Datasworn.OracleTableText2).column_labels.text2,
      });
    }
    if (numColumns >= 3) {
      tr.createEl("th", {
        text: (oracleDesc as Datasworn.OracleTableText3).column_labels.text3,
      });
    }
  }
  const body = table.createEl("tbody");
  for (const row of oracleDesc.rows) {
    const tr = body.createEl("tr");
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
    await MarkdownRenderer.render(app, row.text, td, "", component);
    if (numColumns >= 2) {
      const td = tr.createEl("td");
      await MarkdownRenderer.render(
        app,
        (row as Datasworn.OracleRollableRowText2).text2 ?? "",
        td,
        "",
        component,
      );
    }
    if (numColumns >= 3) {
      const td = tr.createEl("td");
      await MarkdownRenderer.render(
        app,
        (row as Datasworn.OracleRollableRowText3).text3 ?? "",
        td,
        "",
        component,
      );
    }
  }
  return table;
}
