import {
  ActionContext,
  CharacterActionContext,
} from "characters/action-context";
import IronVaultPlugin from "index";
import * as kdl from "kdljs";
import { Editor, EditorRange } from "obsidian";
import {
  findAdjacentCodeBlock,
  interiorRange,
  reverseLineIterator,
  updateCodeBlockInterior,
} from "../utils/editor";
import { ActorDescription } from "./actor";
import * as ops from "./operations";

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
      plugin.characters.ofValid.size > 1
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
