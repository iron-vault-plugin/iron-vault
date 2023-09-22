import { type App, type Editor, type MarkdownView } from "obsidian";
import { type Datastore } from "./datastore";
import { CustomSuggestModal } from "./utils/suggest";
import { type OracleBase, type OracleTable } from "dataforged";
import { type Roll, OracleRoller } from "./oracles/rolls";

function formatOraclePath(
  index: Map<string, OracleBase>,
  oracle: OracleBase,
): string {
  const parts = oracle.Ancestors.map(
    (id) => index.get(id)?.Title.Standard ?? "??",
  );
  parts.push(oracle.Title.Standard);
  return parts.join(" / ");
}

function renderRoll(roll: Roll): string {
  switch (roll.kind) {
    case "multi":
      return `(${roll.roll} on ${roll.table.Title.Standard} -> ${
        roll.row.Result
      }): ${roll.results.map((r) => renderRoll(r)).join(", ")}`;
    case "simple":
      return `(${roll.roll} on ${roll.table.Title.Standard}) ${roll.row.Result}`;
    case "templated":
      return `(${roll.roll} on ${roll.table.Title.Standard}) ${roll.row[
        "Roll template"
      ]?.Result?.replace(/\{\{([^{}]+)\}\}/g, (_match, id) => {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        return renderRoll(roll.templateRolls.get(id)!);
      })}`;
    default: {
      const _exhaustiveCheck: never = roll;
      return _exhaustiveCheck;
    }
  }
}

export async function runOracleCommand(
  app: App,
  datastore: Datastore,
  editor: Editor,
  view: MarkdownView,
): Promise<void> {
  if (!datastore.ready) {
    console.warn("data not ready");
    return;
  }
  const oracles: OracleTable[] = [];
  for (const oracle of datastore.oracles.values()) {
    if (oracle.Table != null) {
      oracles.push(oracle as OracleTable);
    }
  }
  const oracle = await CustomSuggestModal.select(
    app,
    oracles,
    formatOraclePath.bind(undefined, datastore.oracles),
  );
  console.log(oracle);
  const roller = new OracleRoller(datastore.oracles);
  const result = roller.roll(oracle);
  editor.replaceSelection(
    `> [!oracle] Oracle: ${formatOraclePath(
      datastore.oracles,
      oracle,
    )}: ${renderRoll(result)}\n\n`,
  );
}
