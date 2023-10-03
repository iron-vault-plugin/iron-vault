import { type OracleTable } from "dataforged";
import {
  stringifyYaml,
  type App,
  type Editor,
  type MarkdownView,
} from "obsidian";
import { dehydrateRoll } from "oracles/roller";
import { formatOraclePath } from "oracles/utils";
import { type Datastore } from "../datastore";
import { CustomSuggestModal } from "../utils/suggest";
import { OracleRoller } from "./roller";

export async function runOracleCommand(
  app: App,
  datastore: Datastore,
  editor: Editor,
  _view: MarkdownView,
): Promise<void> {
  if (!datastore.ready) {
    console.warn("data not ready");
    return;
  }
  const oracles: OracleTable[] = [...datastore.oracles.tables()];
  const oracle = await CustomSuggestModal.select(
    app,
    oracles,
    formatOraclePath.bind(undefined, datastore.oracles),
  );
  console.log(oracle);
  const roller = new OracleRoller(datastore.oracles);
  const result = roller.roll(oracle);
  editor.replaceSelection(
    `\`\`\`oracle\n${stringifyYaml(dehydrateRoll(result))}\`\`\`\n\n`,
  );
}
