import { Editor, MarkdownFileInfo, Notice } from "obsidian";

import {
  DiceExprGroup,
  parseDiceExpression,
  PlainDiceRoller,
} from "@ironvault/dice";
import IronVaultPlugin from "index";
import { GraphicalDiceRoller } from "utils/dice-roller";
import { CustomSuggestModal } from "utils/suggest";
import { PromptModal } from "utils/ui/prompt";
import { appendNodesToMoveOrMechanicsBlock } from "./editor";
import { createDetailsNode, createDiceExpressionNode } from "./node-builders";

export async function insertComment(plugin: IronVaultPlugin, editor: Editor) {
  const comment = await PromptModal.prompt(plugin.app, "Enter your comment");
  appendNodesToMoveOrMechanicsBlock(editor, createDetailsNode(comment));
}

export async function rollDice(
  plugin: IronVaultPlugin,
  editor: Editor,
  view: MarkdownFileInfo,
) {
  const localSettings =
    view.file && plugin.localSettings.forCampaign(view.file);

  // TODO: track recent rolls and allow re-rolling
  const roll = await CustomSuggestModal.selectWithUserEntry(
    plugin.app,
    localSettings?.recentRolls ?? [],
    ({ expression }) => expression,
    (input, el) => {
      try {
        const parsed = new DiceExprGroup([parseDiceExpression(input)]);
        el.textContent = parsed.exprs[0].toString();
      } catch (error) {
        el.textContent = `Invalid expression: ${error}`;
      }
    },
    () => {},
    "Enter your dice roll (e.g., 2d6+3)",
    (input) => ({
      expression: input,
    }),
  );

  const roller = plugin.settings.graphicalActionDice
    ? new GraphicalDiceRoller(plugin)
    : PlainDiceRoller.INSTANCE;

  let parsed: DiceExprGroup;
  try {
    parsed = new DiceExprGroup([parseDiceExpression(roll.value.expression)]);
  } catch (error) {
    console.error("Failed to parse dice expression:", error);
    new Notice("Invalid dice expression. Please use a format like '2d6+3'.");
    return;
  }

  if (localSettings) {
    localSettings.addRecentRoll(parsed.exprs[0].toString());
  }

  const dice = parsed.flattenDiceToGroup();
  const rolls = await roller.rollAsync(dice);

  const evaledExpr = parsed.applyValues(rolls).exprs[0];

  appendNodesToMoveOrMechanicsBlock(
    editor,
    createDiceExpressionNode({ evaledExpr }),
  );
}
