import IronVaultPlugin from "index";
import { rootLogger } from "logger";
import { createOrAppendMechanics } from "mechanics/editor";
import { createOracleNode } from "mechanics/node-builders";
import {
  EditorSelection,
  MarkdownFileInfo,
  type Editor,
  type MarkdownView,
} from "obsidian";
import { numberRange } from "utils/numbers";
import { CurseBehavior, Oracle, OracleGroupingType } from "../model/oracle";
import { Roll, RollWrapper } from "../model/rolls";
import { CustomSuggestModal } from "../utils/suggest";
import { OracleRollerModal } from "./modal";
import { OracleRoller } from "./roller";

const logger = rootLogger.getLogger("oracles");

export function formatOraclePath(oracle: Oracle): string {
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
  return `${path.join(" / ")}`;
}

export function oracleRuleset(oracle: Oracle): string {
  let current = oracle.parent;
  while (
    current != null &&
    current.grouping_type !== OracleGroupingType.Ruleset
  ) {
    current = current.parent;
  }
  return current?.name ?? "Unknown";
}

export async function runOracleCommand(
  plugin: IronVaultPlugin,
  editor: Editor,
  view: MarkdownView | MarkdownFileInfo,
  chosenOracle?: Oracle,
): Promise<void> {
  // Detect if the line already has text on it-- this is the prompt
  let prompt: string | undefined = undefined;
  const [selection, ...rest] = editor.listSelections();
  let replaceSelection: EditorSelection = selection;
  if (selection && rest.length == 0) {
    prompt = editor.getRange(selection.anchor, selection.head);
    if (!prompt && selection.anchor.line == selection.head.line) {
      prompt = editor.getLine(selection.anchor.line);
      logger.debug("prompt: '%s'", prompt);

      // TODO: if I wanted to split the line around the cursor, this is how I can do it!
      // const rightMost = Math.max(selection.anchor.ch, selection.head.ch);
      // const afterText = prompt.slice(rightMost);
      // if (afterText.length > 0) {
      //   console.warn("after text: %s", afterText);
      // }

      // In this scenario, we will replace the whole line with the oracle block
      replaceSelection = {
        anchor: { line: selection.anchor.line, ch: 0 },
        head: { line: selection.anchor.line, ch: prompt.length },
      };
    }

    prompt = prompt.trim();
    if (!prompt) {
      prompt = undefined;
    }
  } else {
    logger.error(
      "Canceling oracle: Expected exactly one selection; found %d: %o",
    );
    return;
  }

  let oracle: Oracle;
  if (chosenOracle) {
    oracle = chosenOracle;
  } else {
    const oracles: Oracle[] = [...plugin.datastore.oracles.values()];
    oracle = await CustomSuggestModal.select(
      plugin.app,
      oracles,
      formatOraclePath,
      (match, el) => {
        const ruleset = oracleRuleset(match.item);
        el.createEl("small", { cls: "iron-vault-suggest-hint" })
          .createEl("strong")
          .createEl("em", { text: ruleset });
      },
      prompt ? `Select an oracle to answer '${prompt}'` : "Select an oracle",
    );
  }
  const rollContext = new OracleRoller(plugin.datastore.oracles);

  // If user wishes to make their own roll, prompt them now.
  let initialRoll: Roll | undefined = undefined;
  if (plugin.settings.promptForRollsInOracles) {
    const diceValue = await CustomSuggestModal.select(
      plugin.app,
      [
        "Roll for me",
        ...numberRange(oracle.dice.minRoll(), oracle.dice.maxRoll()),
      ],
      (x) => x.toString(),
      undefined,
      `Roll your oracle dice (${oracle.dice}) and enter the value`,
    );
    if (typeof diceValue === "number") {
      initialRoll = await oracle.evaluate(rollContext, diceValue);
    }
  }

  new OracleRollerModal(
    plugin,
    oracle,
    new RollWrapper(
      oracle,
      rollContext,
      initialRoll || (await oracle.roll(rollContext)),
    ),
    (roll, cursedRoll?) => {
      // Delete the prompt and then inject the oracle node to a mechanics block
      editor.setSelection(replaceSelection.anchor, replaceSelection.head);
      editor.replaceSelection("");
      const oracleNode = createOracleNode(roll, prompt);
      const oracleNodes = [oracleNode];
      if (cursedRoll) {
        oracleNode.children.push(createOracleNode(cursedRoll));
        oracleNode.properties.replaced =
          cursedRoll.oracle.curseBehavior === CurseBehavior.ReplaceResult;
      }
      createOrAppendMechanics(editor, oracleNodes);
    },
    () => {},
  ).open();
}
