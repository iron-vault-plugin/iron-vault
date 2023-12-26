import {
  stringifyYaml,
  type App,
  type Editor,
  type MarkdownView,
} from "obsidian";
import { type Datastore } from "../datastore";
import { Oracle, OracleGroupingType } from "../model/oracle";
import { RollWrapper } from "../model/rolls";
import { CustomSuggestModal } from "../utils/suggest";
import { OracleRollerModal } from "./modal";
import { renderOracleCallout } from "./render";
import { OracleRoller } from "./roller";
import { type OracleSchema } from "./schema";

export function formatOracleBlock({
  question,
  roll,
}: {
  question?: string;
  roll: RollWrapper;
}): string {
  const oracle: OracleSchema = {
    question,
    roll: roll.dehydrate(),
  };
  return `\`\`\`oracle\n${stringifyYaml(oracle)}\`\`\`\n\n`;
}

const USE_ORACLE_BLOCK = false;

export function formatOraclePath(oracle: Oracle) {
  let current = oracle.parent;
  const path = [];
  while (
    current != null &&
    current.grouping_type != OracleGroupingType.Ruleset
  ) {
    path.unshift(current.name);
    current = current.parent;
  }
  path.push(oracle.name);
  return `${path.join(" / ")} (${current?.name ?? "Unknown"})`;
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
  const oracles: Oracle[] = [...datastore.oracles.values()];
  const oracle = await CustomSuggestModal.select(
    app,
    oracles,
    formatOraclePath,
  );
  console.log(oracle);
  const rollContext = new OracleRoller(datastore.oracles);
  new OracleRollerModal(
    app,
    rollContext,
    oracle,
    undefined,
    (roll) => {
      if (USE_ORACLE_BLOCK) {
        editor.replaceSelection(formatOracleBlock({ roll }));
      } else {
        editor.replaceSelection(
          renderOracleCallout({ roll: roll.dehydrate() }),
        );
      }
    },
    () => {},
  ).open();
}
