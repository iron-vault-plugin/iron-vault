import {
  EditorSelection,
  MarkdownFileInfo,
  type Editor,
  type MarkdownView,
} from "obsidian";

import { numberRange } from "@ironvault/utils/numbers";
import { determineCampaignContext } from "campaigns/manager";
import IronVaultPlugin from "index";
import { rootLogger } from "logger";
import { createOrAppendMechanics } from "mechanics/editor";
import { createOracleNode } from "mechanics/node-builders";
import { Oracle, OracleGrouping, OracleGroupingType } from "../model/oracle";
import { Roll } from "../model/rolls";
import { CustomSuggestModal } from "../utils/suggest";
import { OracleRollerModal } from "./modal";
import { NewOracleRollerModal } from "./new-modal";
import { oracleNameWithParents } from "./render";
import { OracleRoller } from "./roller";

const logger = rootLogger.getLogger("oracles");

export function oracleRuleset(oracle: Oracle): string {
  let current: OracleGrouping = oracle.parent;
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

  const campaignContext = await determineCampaignContext(plugin, view);

  let oracle: Oracle;
  if (chosenOracle) {
    // TODO(@cwegrzyn): if this is called with a specific oracle, should it
    // also have a specific campaign context?
    oracle = chosenOracle;
  } else {
    const oracles: Oracle[] = [...campaignContext.oracles.values()];
    oracle = await CustomSuggestModal.select(
      plugin.app,
      oracles,
      oracleNameWithParents,
      (match, el) => {
        const ruleset = oracleRuleset(match.item);
        el.createEl("small", { cls: "iron-vault-suggest-hint" })
          .createEl("strong")
          .createEl("em", { text: ruleset });
      },
      prompt ? `Select an oracle to answer '${prompt}'` : "Select an oracle",
    );
  }
  const rollContext = new OracleRoller(plugin, campaignContext.oracles);

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
      initialRoll = oracle.evaluate(rollContext, diceValue);
    }
  }

  const modal = plugin.settings.useLegacyRoller
    ? OracleRollerModal
    : NewOracleRollerModal;
  const { roll, cursedRoll } = await modal.forRoll(
    plugin,
    oracle,
    rollContext,
    initialRoll || (await oracle.roll(rollContext)),
  );

  // Delete the prompt and then inject the oracle node to a mechanics block
  editor.setSelection(replaceSelection.anchor, replaceSelection.head);
  editor.replaceSelection("");
  createOrAppendMechanics(editor, [
    createOracleNode(roll, prompt, undefined, cursedRoll),
  ]);
}
