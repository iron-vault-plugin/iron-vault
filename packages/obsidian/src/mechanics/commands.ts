import { Editor, MarkdownFileInfo, Notice } from "obsidian";

import {
  DiceExprGroup,
  ExprNode,
  parseDiceExpression,
  PlainDiceRoller,
} from "@ironvault/dice";
import IronVaultPlugin from "index";
import { GraphicalDiceRoller } from "utils/dice-roller";
import { CustomSuggestModal } from "utils/suggest";
import { PromptModal } from "utils/ui/prompt";
import { appendNodesToMoveOrMechanicsBlock } from "./editor";
import { createDetailsNode, createDiceExpressionNode } from "./node-builders";
import { diceRollToInlineSyntax } from "../inline";
import { insertInlineText } from "../inline/editor-utils";

/**
 * Format a dice expression with roll values shown.
 * e.g., "10d6 + 5" with rolls [1,2,3,4,5,6,1,2,3,4] becomes "10d6{1+2+3+4+5+6+1+2+3+4=31} + 5"
 * For simple single-die rolls like "1d6", just shows "4" instead of "1d6{4=4}"
 */
function formatExpressionWithRolls(
  expr: ExprNode<{ value: number; rolls?: number[] }>,
): string {
  // Pre-scan to detect if expression has any operations (binary/unary)
  function hasOperations(
    node: ExprNode<{ value: number; rolls?: number[] }>,
  ): boolean {
    if ("left" in node && "right" in node && "operator" in node) {
      return true;
    }
    if ("operand" in node && "operator" in node) {
      return true;
    }
    return false;
  }

  const exprHasOperations = hasOperations(expr);

  // Walk the expression tree and build a formatted string
  function formatNode(
    node: ExprNode<{ value: number; rolls?: number[] }>,
  ): string {
    // Check if this is a dice node by looking for rolls in the label
    if (node.label.rolls && node.label.rolls.length > 0) {
      const rolls = node.label.rolls;
      // Only show brackets if there's actual math: multiple dice OR operations in the expression
      if (rolls.length === 1 && !exprHasOperations) {
        // Single die, no modifiers - just show "1d100" (renderer adds "→ result")
        return node.toString();
      }
      // Format as "NdS{r1+r2+...}" - just show the rolls, no sum (final result shown after arrow)
      return `${node.toString()}{${rolls.join("+")}}`;
    }

    // For binary operations, recursively format children
    if ("left" in node && "right" in node && "operator" in node) {
      const binNode = node as unknown as {
        left: ExprNode<{ value: number; rolls?: number[] }>;
        right: ExprNode<{ value: number; rolls?: number[] }>;
        operator: string;
        precedence: number;
      };
      const leftStr = formatNode(binNode.left);
      const rightStr = formatNode(binNode.right);
      return `${leftStr} ${binNode.operator} ${rightStr}`;
    }

    // For unary operations
    if ("operand" in node && "operator" in node) {
      const unaryNode = node as unknown as {
        operand: ExprNode<{ value: number; rolls?: number[] }>;
        operator: string;
      };
      return `${unaryNode.operator}${formatNode(unaryNode.operand)}`;
    }

    // For number nodes or anything else, just use toString
    return node.toString();
  }

  return formatNode(expr);
}

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

  // Use inline format if enabled
  if (plugin.settings.useInlineDiceRolls) {
    const expression = formatExpressionWithRolls(evaledExpr);
    const result = evaledExpr.label.value;
    const inlineText = diceRollToInlineSyntax(expression, result);
    insertInlineText(editor, inlineText);
    return;
  }

  appendNodesToMoveOrMechanicsBlock(
    editor,
    createDiceExpressionNode({ evaledExpr }),
  );
}
