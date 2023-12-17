import { type OracleTable } from "dataforged";
import { type Roll } from "model/rolls";
import {
  stringifyYaml,
  type App,
  type Editor,
  type MarkdownView,
} from "obsidian";
import { OracleRoller, TableWrapper, dehydrateRoll } from "oracles/roller";
import { formatOraclePath } from "oracles/utils";
import { type Datastore } from "../datastore";
import { CustomSuggestModal } from "../utils/suggest";
import { OracleRollerModal } from "./modal";
import { renderOracleCallout } from "./render";
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

const USE_ORACLE_BLOCK = false;

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
  new OracleRollerModal(
    app,
    new TableWrapper(oracle, new OracleRoller(datastore.oracles)),
    undefined,
    (roll) => {
      if (USE_ORACLE_BLOCK) {
        editor.replaceSelection(formatOracleBlock({ roll }));
      } else {
        editor.replaceSelection(
          renderOracleCallout({ roll: dehydrateRoll(roll) }),
        );
      }
    },
    () => {},
  ).open();
}
