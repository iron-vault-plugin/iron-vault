import { type OracleTable } from "dataforged";
import {
  stringifyYaml,
  type App,
  type Editor,
  type MarkdownView,
} from "obsidian";
import { dehydrateRoll, type Roll } from "oracles/roller";
import { formatOraclePath } from "oracles/utils";
import { type Datastore } from "../datastore";
import { CustomSuggestModal } from "../utils/suggest";
import { OracleRoller } from "./roller";
import { type OracleSchema } from "./schema";

export function formatOracleBlock({
  question,
  roll,
}: {
  question?: string;
  roll: Roll;
}): string {
  const oracle: OracleSchema = {
    question,
    roll: dehydrateRoll(roll),
  };
  return `\`\`\`oracle\n${stringifyYaml(oracle)}\`\`\`\n\n`;
}

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
  editor.replaceSelection(formatOracleBlock({ roll: roller.roll(oracle) }));
}
