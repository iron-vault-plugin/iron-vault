import { type Datasworn } from "@datasworn/core";
import {
  ActionContext,
  CharacterActionContext,
  determineCharacterActionContext,
  formatActionContextDescription,
} from "characters/action-context";
import { labelForMeter } from "characters/display";
import {
  AnyDataswornMove,
  scopeSourceForMove,
} from "datastore/datasworn-indexer";
import IronVaultPlugin from "index";
import { rootLogger } from "logger";
import {
  createOrAppendMechanicsWithActor,
  findAdjacentMechanicsBlock,
  updatePreviousMoveOrCreateBlockWithActor,
} from "mechanics/editor";
import {
  generateActionRoll,
  generateMechanicsNode,
} from "mechanics/node-builders";
import { getMoveIdFromNode, getTerminalMoveNode } from "mechanics/utils";
import {
  MarkdownFileInfo,
  type App,
  type Editor,
  type MarkdownView,
} from "obsidian";
import { MeterCommon } from "rules/ruleset";
import { DiceGroup } from "utils/dice-group";
import { AsyncDiceRoller } from "utils/dice-roller";
import { numberRange } from "utils/numbers";
import {
  MeterWithLens,
  MeterWithoutLens,
  momentumOps,
} from "../../characters/lens";
import { ProgressContext } from "../../tracks/context";
import { selectProgressTrack } from "../../tracks/select";
import { ProgressTrackWriterContext } from "../../tracks/writer";
import { Dice, DieKind } from "../../utils/dice";
import { vaultProcess } from "../../utils/obsidian";
import { CustomSuggestModal } from "../../utils/suggest";
import {
  ActionMoveAdd,
  NoRollMoveDescription,
  type ActionMoveDescription,
  type MoveDescription,
  type ProgressMoveDescription,
} from "../desc";
import { ActionMoveWrapper } from "../wrapper";
import { checkForMomentumBurn } from "./action-modal";
import { AddsModal } from "./adds-modal";

const logger = rootLogger.getLogger("moves");

enum MoveKind {
  Progress = "Progress",
  Action = "Action",
  Other = "Other",
}

function getMoveKind(move: Datasworn.AnyMove): MoveKind {
  switch (move.roll_type) {
    case "action_roll":
      return MoveKind.Action;
    case "progress_roll":
      return MoveKind.Progress;
    case "special_track":
    case "no_roll":
      return MoveKind.Other;
    default:
      throw new Error(
        `unexpected roll type ${(move as Datasworn.EmbeddedMove).roll_type} on move id ${
          (move as Datasworn.EmbeddedMove)._id
        }`,
      );
  }
}

const ROLL_TYPES: Record<Datasworn.Move["roll_type"], string> = {
  action_roll: "Action roll",
  progress_roll: "Progress roll",
  no_roll: "No roll",
  special_track: "Special track roll",
};

async function promptForMove(
  plugin: IronVaultPlugin,
  context: ActionContext,
): Promise<Datasworn.AnyMove> {
  const moves = [...context.moves.values()].sort((a, b) =>
    a.name.localeCompare(b.name),
  );
  const choice = await CustomSuggestModal.selectWithUserEntry<AnyDataswornMove>(
    plugin.app,
    moves,
    (move) => move.name,
    (input, el) => {
      el.setText(`Use custom move '${input}'`);
    },
    ({ item: move }, el: HTMLElement) => {
      const moveKind = getMoveKind(move);
      el.createEl("small", {
        text: `(${moveKind}) ${move.trigger.text}`,
        cls: "iron-vault-suggest-hint",
      });
      el.createEl("br");
      el.createEl("small", {
        cls: "iron-vault-suggest-hint",
      })
        .createEl("strong")
        .createEl("em", {
          text: scopeSourceForMove(move).title,
        });
    },
    `Select a move ${formatActionContextDescription(context)}`,
  );

  if (choice.kind == "pick") {
    return choice.value;
  }

  const roll_type = await CustomSuggestModal.select(
    plugin.app,
    Object.keys(ROLL_TYPES) as Datasworn.Move["roll_type"][],
    (item) => ROLL_TYPES[item],
    undefined,
    "Select a roll type for this move",
  );

  return createPlaceholderMove(roll_type, choice.custom);
}

/** Creates a move with only a roll_type and name. */
function createPlaceholderMove(
  roll_type: "action_roll",
  name: string,
): Datasworn.EmbeddedActionRollMove;
function createPlaceholderMove(
  roll_type: "progress_roll",
  name: string,
): Datasworn.EmbeddedProgressRollMove;
function createPlaceholderMove(
  roll_type: "special_track",
  name: string,
): Datasworn.EmbeddedSpecialTrackMove;
function createPlaceholderMove(
  roll_type: "no_roll",
  name: string,
): Datasworn.EmbeddedNoRollMove;
function createPlaceholderMove(
  roll_type: Datasworn.MoveRollType,
  name: string,
): Datasworn.EmbeddedMove;
function createPlaceholderMove(
  roll_type: Datasworn.MoveRollType,
  name: string,
): Datasworn.EmbeddedMove {
  const baseMove = {
    roll_type,
    type: "move",
    _id: "",
    name,
    text: "",
  } satisfies Partial<Datasworn.EmbeddedMove>;

  switch (baseMove.roll_type) {
    case "action_roll":
      return {
        ...baseMove,
        roll_type: baseMove.roll_type,
        trigger: { conditions: [], text: "" },
        outcomes: {
          strong_hit: { text: "" },
          weak_hit: { text: "" },
          miss: { text: "" },
        },
        allow_momentum_burn: true,
      } satisfies Datasworn.EmbeddedActionRollMove;
    case "no_roll":
      return {
        ...baseMove,
        roll_type: baseMove.roll_type,
        trigger: { conditions: [], text: "" },
        outcomes: null,
        allow_momentum_burn: false,
      } satisfies Datasworn.EmbeddedNoRollMove;
    case "progress_roll":
      return {
        ...baseMove,
        roll_type: baseMove.roll_type,
        trigger: { conditions: [], text: "" },
        outcomes: {
          strong_hit: { text: "" },
          weak_hit: { text: "" },
          miss: { text: "" },
        },
        tracks: { category: "*" },
        allow_momentum_burn: false,
      } satisfies Datasworn.EmbeddedProgressRollMove;
    case "special_track":
      return {
        ...baseMove,
        roll_type: baseMove.roll_type,
        trigger: { conditions: [], text: "" },
        outcomes: {
          strong_hit: { text: "" },
          weak_hit: { text: "" },
          miss: { text: "" },
        },
        allow_momentum_burn: false,
      } satisfies Datasworn.EmbeddedSpecialTrackMove;
  }
}

function assertInRange(
  val: number,
  min: number,
  max: number,
  desc?: string,
): void {
  if (val < min || val > max) {
    throw new Error(
      `Expected ${desc ?? "value"} to be between ${min} and ${max}, but was ${val}`,
    );
  }
}

async function processActionMove(
  diceRoller: AsyncDiceRoller,
  move: Datasworn.MoveActionRoll | Datasworn.EmbeddedActionRollMove,
  stat: string,
  statVal: number,
  adds: ActionMoveAdd[],
  roll?: { action: number; challenge1: number; challenge2: number } | undefined,
): Promise<ActionMoveDescription> {
  if (!roll) {
    const res = await diceRoller.rollAsync(
      DiceGroup.of(
        new Dice(1, 6, DieKind.Action),
        new Dice(1, 10, DieKind.Challenge1),
        new Dice(1, 10, DieKind.Challenge2),
      ),
    );
    roll = {
      action: res[0].value,
      challenge1: res[1].value,
      challenge2: res[2].value,
    };
  }
  const { action, challenge1, challenge2 } = roll;
  assertInRange(action, 1, 6, "action");
  assertInRange(challenge1, 1, 10, "first challenge dice");
  assertInRange(challenge2, 1, 10, "second challenge dice");
  return {
    id: move._id,
    name: move.name,
    action,
    stat,
    statVal,
    adds,
    challenge1,
    challenge2,
  };
}

async function processProgressMove(
  move: Datasworn.MoveProgressRoll | Datasworn.EmbeddedProgressRollMove,
  tracker: ProgressTrackWriterContext,
  diceRoller: AsyncDiceRoller,
  roll?: { challenge1: number; challenge2: number },
): Promise<ProgressMoveDescription> {
  if (!roll) {
    const res = await diceRoller.rollAsync(
      DiceGroup.of(
        new Dice(1, 10, DieKind.Challenge1),
        new Dice(1, 10, DieKind.Challenge2),
      ),
    );
    roll = {
      challenge1: res[0].value,
      challenge2: res[1].value,
    };
  }
  const { challenge1, challenge2 } = roll;
  assertInRange(challenge1, 1, 10, "challenge1");
  assertInRange(challenge2, 1, 10, "challenge2");
  return {
    id: move._id,
    name: move.name,
    progressTrack: `[[${tracker.location}|${tracker.name}]]`,
    progressTicks: tracker.track.progress,
    challenge1,
    challenge2,
  };
}

export function validAdds(baseStat: number): number[] {
  const adds = [];
  for (let add = 0; 1 + baseStat + add <= 10; add++) {
    adds.push(add);
  }
  return adds;
}

export async function runMoveCommand(
  plugin: IronVaultPlugin,
  editor: Editor,
  view: MarkdownView | MarkdownFileInfo,
  chosenMove?: AnyDataswornMove,
  chosenMeter?: MeterWithLens | MeterWithoutLens,
  skipRoll: boolean = false,
): Promise<void> {
  if (view.file?.path == null) {
    logger.error("No file for view. Why?");
    return;
  }

  const context = await determineCharacterActionContext(plugin, view);

  const diceRoller = context.campaignContext.diceRollerFor("move");

  // Use the provided move, or prompt the user for a move appropriate to the current action context.
  const move: Datasworn.AnyMove =
    chosenMove ?? (await promptForMove(plugin, context));

  let moveDescription: MoveDescription;
  if (skipRoll) {
    moveDescription = createEmptyMoveDescription(move);
  } else {
    switch (move.roll_type) {
      case "action_roll": {
        moveDescription = await handleActionRoll(
          plugin,
          diceRoller,
          context,
          move,
          true,
          chosenMeter,
        );
        break;
      }
      case "progress_roll": {
        moveDescription = await handleProgressRoll(
          plugin,
          diceRoller,
          new ProgressContext(plugin, context),
          move,
        );
        break;
      }
      case "no_roll":
        moveDescription = createEmptyMoveDescription(move);
        break;
      case "special_track":
      default:
        // TODO: this probably makes sense with new mechanics format?
        logger.warn(
          "Teach me how to handle a move with roll type %s: %o",
          move.roll_type,
          move,
        );
        moveDescription = createEmptyMoveDescription(move);
    }
  }

  createOrAppendMechanicsWithActor(
    editor,
    plugin,
    context,
    generateMechanicsNode(moveDescription),
  );
}

function createEmptyMoveDescription(
  move: Datasworn.AnyMove,
): NoRollMoveDescription {
  return {
    id: move._id,
    name: move.name,
  } satisfies NoRollMoveDescription;
}

async function handleProgressRoll(
  plugin: IronVaultPlugin,
  diceRoller: AsyncDiceRoller,
  progressContext: ProgressContext,
  move: Datasworn.MoveProgressRoll | Datasworn.EmbeddedProgressRollMove,
): Promise<MoveDescription> {
  const progressTrack = await selectProgressTrack(
    progressContext,
    plugin,
    (prog) =>
      (move.tracks.category == "*" || prog.trackType == move.tracks.category) &&
      !prog.track.complete,
  );

  let rolls: { challenge1: number; challenge2: number } | undefined;
  if (plugin.settings.promptForRollsInMoves) {
    const challenge1 = await CustomSuggestModal.select(
      plugin.app,
      ["Roll for me", ...numberRange(1, 10)],
      (x) => x.toString(),
      undefined,
      "Roll your first challenge die (1d10) and enter the value",
    );
    if (typeof challenge1 !== "string") {
      const challenge2 = await CustomSuggestModal.select(
        plugin.app,
        numberRange(1, 10),
        (x) => x.toString(),
        undefined,
        "Enter your second challenge die (1d10)",
      );

      rolls = { challenge1, challenge2 };
    }
  }

  // TODO: when would we mark complete? should we prompt on a hit?
  return await processProgressMove(move, progressTrack, diceRoller, rolls);
}

const ORDINALS = [
  "zeroth",
  "first",
  "second",
  "third",
  "fourth",
  "fifth",
  "sixth",
  "seventh",
  "eighth",
  "ninth",
  "tenth",
];

export function suggestedRollablesForMove(
  move: Datasworn.MoveActionRoll | Datasworn.EmbeddedActionRollMove,
): Record<
  string,
  Array<Omit<Datasworn.TriggerActionRollCondition, "roll_options">>
> {
  const suggestedRollables: Record<
    string,
    Array<Omit<Datasworn.TriggerActionRollCondition, "roll_options">>
  > = {};

  for (const condition of move.trigger.conditions) {
    const { roll_options, ...conditionSpec } = condition;
    for (const rollable of roll_options) {
      let rollableToAdd;
      switch (rollable.using) {
        case "stat":
          rollableToAdd = rollable.stat;
          break;
        case "condition_meter":
          rollableToAdd = rollable.condition_meter;
          break;
        default:
          logger.warn("unhandled rollable scenario %o %o", condition, rollable);
      }
      if (!rollableToAdd) continue;
      if (!(rollableToAdd in suggestedRollables)) {
        suggestedRollables[rollableToAdd] = [];
      }
      suggestedRollables[rollableToAdd].push(conditionSpec);
    }
  }
  return suggestedRollables;
}

async function handleActionRoll(
  plugin: IronVaultPlugin,
  diceRoller: AsyncDiceRoller,
  actionContext: ActionContext,
  move: Datasworn.MoveActionRoll | Datasworn.EmbeddedActionRollMove,
  allowSkip: true,
  meter?: MeterWithLens | MeterWithoutLens,
): Promise<NoRollMoveDescription | ActionMoveDescription>;
async function handleActionRoll(
  plugin: IronVaultPlugin,
  diceRoller: AsyncDiceRoller,
  actionContext: ActionContext,
  move: Datasworn.MoveActionRoll | Datasworn.EmbeddedActionRollMove,
  allowSkip: false,
  meter?: MeterWithLens | MeterWithoutLens,
): Promise<ActionMoveDescription>;
async function handleActionRoll(
  plugin: IronVaultPlugin,
  diceRoller: AsyncDiceRoller,
  actionContext: ActionContext,
  move: Datasworn.MoveActionRoll | Datasworn.EmbeddedActionRollMove,
  allowSkip: boolean,
  meter?: MeterWithLens | MeterWithoutLens,
): Promise<NoRollMoveDescription | ActionMoveDescription> {
  const suggestedRollables = suggestedRollablesForMove(move);

  const stat =
    meter ??
    (await promptForRollable(
      plugin.app,
      actionContext,
      suggestedRollables,
      move,
      allowSkip,
    ));

  if (stat.key === SKIP_ROLL) return createEmptyMoveDescription(move);

  // This stat has an unknown value, so we need to prompt the user for a value.
  let statValue = stat.value;
  if (statValue == null) {
    statValue = await CustomSuggestModal.select(
      plugin.app,
      [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
      (n) => n.toString(10),
      undefined,
      `What is the value of ${stat.definition.label}?`,
    );
  }

  const adds = [];
  // TODO: do we need this arbitrary cutoff on adds? just wanted to avoid a kinda infinite loop
  while (adds.length < 5) {
    const addValue = await CustomSuggestModal.select(
      plugin.app,
      validAdds(statValue ?? 0),
      (n) => n.toString(10),
      undefined,
      `Choose an amount for the ${ORDINALS[adds.length + 1]} add.`,
    );
    if (addValue == 0) break;
    const addReason = await AddsModal.show(plugin.app, `+${addValue}`);
    const add: { amount: number; desc?: string } = { amount: addValue };
    if ((addReason ?? "").length > 0) {
      add.desc = addReason;
    }
    adds.push(add);
  }

  let rolls:
    | { action: number; challenge1: number; challenge2: number }
    | undefined;
  if (plugin.settings.promptForRollsInMoves) {
    const action = await CustomSuggestModal.select(
      plugin.app,
      ["Roll for me", ...numberRange(1, 6)],
      (x) => x.toString(),
      undefined,
      "Roll your action die (1d6) and enter the value",
    );
    if (typeof action !== "string") {
      const challenge1 = await CustomSuggestModal.select(
        plugin.app,
        numberRange(1, 10),
        (x) => x.toString(),
        undefined,
        "Enter your first challenge die (1d10)",
      );
      const challenge2 = await CustomSuggestModal.select(
        plugin.app,
        numberRange(1, 10),
        (x) => x.toString(),
        undefined,
        "Enter your second challenge die (1d10)",
      );
      rolls = { action, challenge1, challenge2 };
    }
  }

  let description = await processActionMove(
    diceRoller,
    move,
    labelForMeter(stat),
    statValue,
    adds,
    rolls,
  );
  const wrapper = new ActionMoveWrapper(description);
  if (actionContext instanceof CharacterActionContext) {
    const { characterContext } = actionContext;
    description = await checkForMomentumBurn(
      plugin.app,
      move as Datasworn.MoveActionRoll,
      wrapper,
      characterContext,
    );
    // TODO: maybe this should be pulled up into the other function (even though it only
    // applies for action moves.
    if (description.burn) {
      await characterContext.updater(
        vaultProcess(plugin.app, actionContext.characterPath),
        (character, { lens }) => momentumOps(lens).reset(character),
      );
    }
  }

  return description;
}

const SKIP_ROLL: unique symbol = Symbol("skip roll");

async function promptForRollable(
  app: App,
  actionContext: ActionContext,
  suggestedRollables: Record<
    string,
    Omit<Datasworn.TriggerActionRollCondition, "roll_options">[]
  >,
  move: Datasworn.MoveActionRoll | Datasworn.EmbeddedActionRollMove,
  allowSkip: boolean,
): Promise<
  (MeterWithLens | MeterWithoutLens | { key: typeof SKIP_ROLL }) & {
    condition: Omit<Datasworn.TriggerActionRollCondition, "roll_options">[];
  }
> {
  const availableRollables = actionContext.rollables;

  const { value: stat } = await CustomSuggestModal.selectWithUserEntry<
    (MeterWithLens | MeterWithoutLens | { key: typeof SKIP_ROLL }) & {
      condition: Omit<Datasworn.TriggerActionRollCondition, "roll_options">[];
    }
  >(
    app,
    [
      ...availableRollables
        .map((meter) => ({
          ...meter,
          condition: suggestedRollables[meter.key] ?? [],
        }))
        .sort((a, b) => {
          if (a.condition.length > 0 && b.condition.length == 0) {
            return -1;
          } else if (a.condition.length == 0 && b.condition.length > 0) {
            return 1;
          } else {
            return (
              (b.value ?? 0) - (a.value ?? 0) ||
              a.definition.label.localeCompare(b.definition.label)
            );
          }
        }),
      ...((allowSkip
        ? [
            {
              key: SKIP_ROLL,
              condition: [],
            },
          ]
        : []) as { key: typeof SKIP_ROLL; condition: [] }[]),
    ],
    (m) =>
      m.key === SKIP_ROLL
        ? "Skip roll"
        : `${labelForMeter(m)}: ${m.value ?? "unknown"}`,
    (input, el) => {
      el.setText(`Use custom meter '${input}'`);
    },
    ({ item }, el) => {
      if (item.condition.length > 0) {
        el.createEl("small", {
          text: `Trigger: ${item.condition.flatMap((cond) => cond.text ?? []).join("; ")}`,
          cls: "iron-vault-suggest-hint",
        });
      }
    },
    move.trigger.text,
    (custom) => ({
      key: custom,
      value: undefined,
      lens: undefined,
      condition: [],
      definition: {
        kind: "stat",
        label: custom,
        min: 0,
        max: 10,
        rollable: true,
      } satisfies MeterCommon,
    }),
  );
  return stat;
}

export async function makeActionRollCommand(
  plugin: IronVaultPlugin,
  editor: Editor,
  view: MarkdownView | MarkdownFileInfo,
): Promise<void> {
  const context = await determineCharacterActionContext(plugin, view);
  const diceRoller = context.campaignContext.diceRollerFor("move");

  const priorBlock = findAdjacentMechanicsBlock(editor);
  let updatePriorMove = false;
  let move: Datasworn.EmbeddedActionRollMove | Datasworn.MoveActionRoll =
    createPlaceholderMove("action_roll", "Generic action roll");
  if (priorBlock) {
    const moveNode = getTerminalMoveNode(priorBlock);
    if (moveNode) {
      logger.debug("Found previous move for block %o", moveNode);
      const rollIndex = moveNode.children.findIndex(
        (node) => node.name === "roll",
      );
      if (rollIndex == -1) {
        // No roll found, so we're going to update this move
        updatePriorMove = true;

        const id = getMoveIdFromNode(moveNode);
        const namedMove = id ? context.moves.get(id) : undefined;
        if (namedMove) {
          if (namedMove.roll_type == "action_roll") {
            // Previous move is an empty action roll -- so let's use
            move = namedMove;
          } else {
            // Previous empty move is not an action roll move. So this probably should
            // not be nested under it.
            updatePriorMove = false;
          }
        }
      }
    }
  }

  const moveDescription: ActionMoveDescription = await handleActionRoll(
    plugin,
    diceRoller,
    context,
    move,
    false,
  );

  const rollNode = generateActionRoll(moveDescription);

  if (updatePriorMove) {
    updatePreviousMoveOrCreateBlockWithActor(
      editor,
      plugin,
      context,
      (moveNode) => {
        // TODO: maybe in theory we should validate that this is actually still the same node?
        moveNode.children.push(rollNode);
        return moveNode;
      },
      () => {
        throw new Error("Unexpectedly missing block");
      },
    );
  } else {
    createOrAppendMechanicsWithActor(editor, plugin, context, [rollNode]);
  }
}
