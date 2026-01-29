import {
  ActionContext,
  CharacterActionContext,
} from "characters/action-context";
import IronVaultPlugin from "index";
import { onlyValid } from "indexer/index-impl";
import { Editor, EditorRange } from "obsidian";
import * as kdl from "utils/kdl";
import {
  findAdjacentCodeBlock,
  interiorRange,
  reverseLineIterator,
  updateCodeBlockInterior,
} from "../utils/editor";
import { ActorDescription } from "./actor";
import * as ops from "./operations";
import {
  moveToInlineSyntax,
  progressToInlineSyntax,
  oracleToInlineSyntax,
  noRollToInlineSyntax,
  actionRollToInlineSyntax,
  insertInlineText,
} from "../inline";
import {
  MoveDescription,
  ActionMoveDescription,
  moveIsAction,
  moveIsProgress,
} from "moves/desc";
import { RollWrapper } from "model/rolls";

export const MECHANICS_CODE_BLOCK_TAG = "iron-vault-mechanics";

/** Appends nodes to an existing mechanics block or inserts a new block. */
export function createOrUpdateBlock(
  editor: Editor,
  blockTag: string,
  updating: (existing?: string) => string,
): void {
  // TODO: right now, if something is selected, we just replace it, and skip the block merging logic. Should we do something else?
  let existingBlockRange: EditorRange | null = null;
  if (!editor.somethingSelected()) {
    existingBlockRange = findAdjacentCodeBlock(
      reverseLineIterator(editor, editor.getCursor()),
      blockTag,
    );
  }

  if (existingBlockRange) {
    // Insert additional nodes at the end of the existing block
    updateCodeBlockInterior(editor, existingBlockRange, updating);
  } else {
    const extraLine = editor.getCursor("from").ch > 0 ? "\n\n" : "";
    editor.replaceSelection(
      `${extraLine}\`\`\`${blockTag}\n${updating()}\`\`\`\n\n`,
    );
  }
}

/** Returns the KDL contents of a prior adjacent mechanics block if one exists. */
export function findAdjacentMechanicsBlock(
  editor: Editor,
): kdl.Document | undefined {
  const lastBlockRange = findAdjacentCodeBlock(
    reverseLineIterator(editor, editor.getCursor()),
    MECHANICS_CODE_BLOCK_TAG,
  );
  if (!lastBlockRange) return undefined;

  const range = interiorRange(lastBlockRange);
  const block = editor.getRange(range.from, range.to);
  const parsed = kdl.parse(block);
  if (parsed.errors.length > 0) {
    return undefined;
  }
  return parsed.output;
}

function makeEditorOp<F extends (...args: never[]) => ops.KdlDocumentTransform>(
  op: F,
): (editor: Editor, ...params: Parameters<F>) => void {
  return (editor, ...params) =>
    createOrUpdateBlock(
      editor,
      MECHANICS_CODE_BLOCK_TAG,
      ops.transformAsKdl(op(...params)),
    );
}

function makeActorAwareEditorOp<
  F extends (...args: never[]) => ops.KdlDocumentTransform,
>(
  op: F,
): (
  editor: Editor,
  plugin: IronVaultPlugin,
  actionContext: ActionContext,
  ...params: Parameters<F>
) => void {
  return (editor, plugin, actionContext, ...params) =>
    createOrUpdateBlock(
      editor,
      MECHANICS_CODE_BLOCK_TAG,
      ops.transformAsKdl(
        ops.usingActor(
          actorForActionContext(plugin, actionContext),
          op(...params),
        ),
      ),
    );
}

/** Appends nodes to an existing mechanics block or inserts a new block. */
export const createOrAppendMechanics = makeEditorOp(ops.appendNodes);

/** Appends nodes to an existing mechanics block or inserts a new block. */
export const createOrAppendMechanicsWithActor = makeActorAwareEditorOp(
  ops.appendNodes,
);

// export function createOrAppendMechanics(
//   editor: Editor,
//   newItems: kdl.Node[],
// ): void {
//   createOrUpdateBlock(
//     editor,
//     MECHANICS_CODE_BLOCK_TAG,
//     ops.transformAsKdl(ops.appendNodes(newItems)),
//   );
// }

/** Allows adding to previous move or creating a new mechanics block. */
export const updatePreviousMoveOrCreateBlock = makeEditorOp(
  ops.updatePreviousMoveOrCreate,
);

/** Allows adding to previous move or creating a new mechanics block. */
export const updatePreviousMoveOrCreateBlockWithActor = makeActorAwareEditorOp(
  ops.updatePreviousMoveOrCreate,
);

/** Adds nodes to the end of a preceding move or block, or creates a new block. */
export const appendNodesToMoveOrMechanicsBlock = makeEditorOp(
  ops.appendNodesToMoveOrTopLevel,
);

/** Adds nodes to the end of a preceding move or block, or creates a new block. */
export const appendNodesToMoveOrMechanicsBlockWithActor =
  makeActorAwareEditorOp(ops.appendNodesToMoveOrTopLevel);

export function actorForActionContext(
  plugin: IronVaultPlugin,
  actionContext: ActionContext,
): ActorDescription | undefined {
  if (actionContext instanceof CharacterActionContext) {
    if (
      plugin.settings.alwaysRecordActor ||
      onlyValid(actionContext.campaignContext.characters).size > 1
    ) {
      return {
        name: actionContext.getWithLens((_) => _.name),
        path: actionContext.characterPath,
      };
    }
  } else {
    // Player is not playing with characters
    // TODO: should we still let players change actors somehow?
  }

  return undefined;
}

/**
 * Insert a move as inline mechanics if the setting is enabled.
 * Returns true if inline was used, false if block should be used.
 */
export function insertInlineMove(
  editor: Editor,
  plugin: IronVaultPlugin,
  move: MoveDescription,
): boolean {
  if (!plugin.settings.useInlineMechanics) {
    return false;
  }

  let inlineText: string;
  if (moveIsAction(move)) {
    inlineText = moveToInlineSyntax(move);
  } else if (moveIsProgress(move)) {
    inlineText = progressToInlineSyntax(move);
  } else {
    // No-roll move
    inlineText = noRollToInlineSyntax(move);
  }

  insertInlineText(editor, inlineText);
  return true;
}

/**
 * Insert an oracle roll as inline mechanics if the setting is enabled.
 * Returns true if inline was used, false if block should be used.
 */
export function insertInlineOracle(
  editor: Editor,
  plugin: IronVaultPlugin,
  roll: RollWrapper,
): boolean {
  if (!plugin.settings.useInlineMechanics) {
    return false;
  }

  const inlineText = oracleToInlineSyntax(roll);

  insertInlineText(editor, inlineText);
  return true;
}

/**
 * Insert an action roll (without a move) as inline mechanics.
 */
export function insertInlineActionRoll(
  editor: Editor,
  _plugin: IronVaultPlugin,
  move: ActionMoveDescription,
): void {
  // Handle both V1 (adds as number) and V2 (adds as array) formats
  const rawAdds = move.adds;
  let addsArray: { amount: number; desc?: string }[];
  let totalAdds: number;

  if (typeof rawAdds === "number") {
    totalAdds = rawAdds;
    addsArray = totalAdds > 0 ? [{ amount: totalAdds }] : [];
  } else {
    addsArray = rawAdds ?? [];
    totalAdds = addsArray.reduce((a, b) => a + b.amount, 0);
  }

  const inlineText = actionRollToInlineSyntax(
    move.stat,
    move.action,
    move.statVal,
    totalAdds,
    move.challenge1,
    move.challenge2,
    addsArray.length > 0 ? addsArray : undefined,
    move.burn,
  );

  insertInlineText(editor, inlineText);
}
