import { Document, Node } from "kdljs";
import { Editor, stringifyYaml } from "obsidian";
import { createOrAppendMechanics } from "../../mechanics/editor";
import { MoveBlockFormat } from "../../settings/ui";
import { node } from "../../utils/kdl";
import { MoveDescription, moveIsAction, moveIsProgress } from "../desc";
import { generateMoveLine } from "../move-line-parser";

function generateMechanicsNode(move: MoveDescription): Document {
  const children: Node[] = [];
  if (moveIsAction(move)) {
    const adds = (move.adds ?? []).reduce((acc, { amount }) => acc + amount, 0);

    // Add "add" nodes for each non-zero add
    children.push(
      ...(move.adds ?? [])
        .filter(({ amount }) => amount != 0)
        .map(({ amount, desc }) =>
          node("add", { values: [amount, ...(desc ? [desc] : [])] }),
        ),
    );

    // Main roll node
    children.push(
      node("roll", {
        values: [move.stat],
        properties: {
          action: move.action,
          stat: move.statVal,
          adds,
          vs1: move.challenge1,
          vs2: move.challenge2,
        },
      }),
    );

    // Momentum burn
    if (move.burn) {
      children.push(
        node("burn", {
          properties: { from: move.burn.orig, to: move.burn.reset },
        }),
      );
    }
  } else if (moveIsProgress(move)) {
    children.push(
      node("progress-roll", {
        properties: {
          // TODO: what about progress track id?
          // TODO: use a ticks prop instead... or at least use a helper to get this
          score: Math.floor(move.progressTicks / 4),
          vs1: move.challenge1,
          vs2: move.challenge2,
        },
      }),
    );
  } else {
    throw new Error("what kind of move is this?");
  }

  // TODO: move name vs move id
  const doc: Document = [
    node("move", {
      values: [move.name],
      children,
    }),
  ];
  return doc;
}
function mechanicsMoveRenderer(
  editor: Editor,
): (move: MoveDescription) => void {
  return (move) => createOrAppendMechanics(editor, generateMechanicsNode(move));
}

export function getMoveRenderer(
  format: MoveBlockFormat,
  editor: Editor,
): (move: MoveDescription) => void {
  switch (format) {
    case MoveBlockFormat.MoveLine:
      return moveLineMoveRenderer(editor);
    case MoveBlockFormat.YAML:
      return yamlMoveRenderer(editor);
    case MoveBlockFormat.Mechanics:
      return mechanicsMoveRenderer(editor);
  }
}
export function yamlMoveRenderer(
  editor: Editor,
): (move: MoveDescription) => void {
  return (move) => {
    editor.replaceSelection(`\`\`\`move\n${stringifyYaml(move)}\n\`\`\`\n\n`);
  };
}

export function moveLineMoveRenderer(
  editor: Editor,
): (move: MoveDescription) => void {
  return (move) => {
    editor.replaceSelection(
      `\`\`\`move\n${generateMoveLine(move)}\n\`\`\`\n\n`,
    );
  };
}
