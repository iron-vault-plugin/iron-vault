import { type Datasworn } from "@datasworn/core";
import {
  ActionContext,
  CharacterActionContext,
  determineCharacterActionContext,
} from "characters/action-context";
import ForgedPlugin from "index";
import {
  type App,
  type Editor,
  type FuzzyMatch,
  type MarkdownView,
} from "obsidian";
import { MeterCommon } from "rules/ruleset";
import {
  MeterWithLens,
  MeterWithoutLens,
  momentumOps,
} from "../../characters/lens";
import { ProgressContext } from "../../tracks/context";
import { selectProgressTrack } from "../../tracks/select";
import { ProgressTrackWriterContext } from "../../tracks/writer";
import { randomInt } from "../../utils/dice";
import { vaultProcess } from "../../utils/obsidian";
import { CustomSuggestModal } from "../../utils/suggest";
import {
  ActionMoveAdd,
  type ActionMoveDescription,
  type MoveDescription,
  type ProgressMoveDescription,
} from "../desc";
import { ActionMoveWrapper } from "../wrapper";
import { checkForMomentumBurn } from "./action-modal";
import { AddsModal } from "./adds-modal";
import { renderMechanics } from "./format";

enum MoveKind {
  Progress = "Progress",
  Action = "Action",
  Other = "Other",
}

function getMoveKind(move: Datasworn.Move): MoveKind {
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
        `unexpected roll type ${(move as Datasworn.Move).roll_type} on move id ${
          (move as Datasworn.Move)._id
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
  app: App,
  context: ActionContext,
): Promise<Datasworn.Move> {
  const moves = [...context.moves].sort((a, b) => a.name.localeCompare(b.name));
  const choice = await CustomSuggestModal.selectWithUserEntry(
    app,
    moves,
    (move) => move.name,
    (input, el) => {
      el.setText(`Use custom move '${input}'`);
    },
    ({ item: move }: FuzzyMatch<Datasworn.Move>, el: HTMLElement) => {
      const moveKind = getMoveKind(move);
      el.createEl("small", {
        text: `(${moveKind}) ${move.trigger.text}`,
        cls: "forged-suggest-hint",
      });
    },
    `Select a move`,
  );

  if (choice.kind == "pick") {
    return choice.value;
  }

  const roll_type = await CustomSuggestModal.select(
    app,
    Object.keys(ROLL_TYPES) as Datasworn.Move["roll_type"][],
    (item) => ROLL_TYPES[item],
    undefined,
    "Select a roll type for this move",
  );

  const baseMove = {
    roll_type,
    type: "move",
    _id: "",
    name: choice.custom,
    _source: {
      title: "Adhoc",
      authors: [],
      date: "0000-00-00",
      license: null,
      url: "",
    },
    text: "",
  } satisfies Partial<Datasworn.Move>;

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
      } satisfies Datasworn.MoveActionRoll;
    case "no_roll":
      return {
        ...baseMove,
        roll_type: baseMove.roll_type,
        trigger: { conditions: [], text: "" },
        outcomes: null,
      } satisfies Datasworn.MoveNoRoll;
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
      } satisfies Datasworn.MoveProgressRoll;
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
      } satisfies Datasworn.MoveSpecialTrack;
  }
}

function processActionMove(
  move: Datasworn.Move,
  stat: string,
  statVal: number,
  adds: ActionMoveAdd[],
): ActionMoveDescription {
  return {
    id: move._id,
    name: move.name,
    action: randomInt(1, 6),
    stat,
    statVal,
    adds,
    challenge1: randomInt(1, 10),
    challenge2: randomInt(1, 10),
  };
}

function processProgressMove(
  move: Datasworn.Move,
  tracker: ProgressTrackWriterContext,
): ProgressMoveDescription {
  return {
    id: move._id,
    name: move.name,
    progressTrack: `[[${tracker.location}]]`,
    progressTicks: tracker.track.progress,
    challenge1: randomInt(1, 10),
    challenge2: randomInt(1, 10),
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
  plugin: ForgedPlugin,
  editor: Editor,
  view: MarkdownView,
  chosenMove?: Datasworn.Move,
): Promise<void> {
  if (view.file?.path == null) {
    console.error("No file for view. Why?");
    return;
  }

  const context = await determineCharacterActionContext(plugin);
  if (!context) {
    // No available/selected character
    return;
  }

  // Use the provided move, or prompt the user for a move appropriate to the current action context.
  const move: Datasworn.Move =
    chosenMove ?? (await promptForMove(plugin.app, context));

  let moveDescription: MoveDescription;
  switch (move.roll_type) {
    case "action_roll": {
      moveDescription = await handleActionRoll(context, plugin.app, move);
      break;
    }
    case "progress_roll": {
      moveDescription = await handleProgressRoll(
        plugin.app,
        new ProgressContext(plugin),
        move,
      );
      break;
    }
    case "no_roll":
    case "special_track":
    default:
      // TODO: this probably makes sense with new mechanics format?
      console.warn(
        "Teach me how to handle a move with roll type %s: %o",
        move.roll_type,
        move,
      );
      return;
  }

  renderMechanics(editor, moveDescription);
}

async function handleProgressRoll(
  app: App,
  progressContext: ProgressContext,
  move: Datasworn.MoveProgressRoll,
): Promise<MoveDescription> {
  const progressTrack = await selectProgressTrack(
    progressContext,
    app,
    (prog) =>
      (move.tracks.category == "*" || prog.trackType == move.tracks.category) &&
      !prog.track.complete,
  );
  // TODO: when would we mark complete? should we prompt on a hit?
  return processProgressMove(move, progressTrack);
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

function suggestedRollablesForMove(
  move: Datasworn.MoveActionRoll,
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
          console.warn(
            "unhandled rollable scenario %o %o",
            condition,
            rollable,
          );
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
  actionContext: ActionContext,
  app: App,
  move: Datasworn.MoveActionRoll,
) {
  const suggestedRollables = suggestedRollablesForMove(move);

  const stat = await promptForRollable(
    app,
    actionContext,
    suggestedRollables,
    move,
  );

  // This stat has an unknown value, so we need to prompt the user for a value.
  if (!stat.value) {
    stat.value = await CustomSuggestModal.select(
      app,
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
      app,
      validAdds(stat.value ?? 0),
      (n) => n.toString(10),
      undefined,
      `Choose an amount for the ${ORDINALS[adds.length + 1]} add.`,
    );
    if (addValue == 0) break;
    const addReason = await AddsModal.show(app, `+${addValue}`);
    const add: { amount: number; desc?: string } = { amount: addValue };
    if ((addReason ?? "").length > 0) {
      add.desc = addReason;
    }
    adds.push(add);
  }

  let description = processActionMove(move, stat.key, stat.value ?? 0, adds);
  const wrapper = new ActionMoveWrapper(description);
  if (actionContext instanceof CharacterActionContext) {
    const { characterContext } = actionContext;
    description = await checkForMomentumBurn(
      app,
      move as Datasworn.MoveActionRoll,
      wrapper,
      characterContext,
    );
    // TODO: maybe this should be pulled up into the other function (even though it only
    // applies for action moves.
    if (description.burn) {
      await characterContext.updater(
        vaultProcess(app, actionContext.characterPath),
        (character, { lens }) => momentumOps(lens).reset(character),
      );
    }
  }

  return description;
}

async function promptForRollable(
  app: App,
  actionContext: ActionContext,
  suggestedRollables: Record<
    string,
    Omit<Datasworn.TriggerActionRollCondition, "roll_options">[]
  >,
  move: Datasworn.MoveActionRoll,
): Promise<
  (MeterWithLens | MeterWithoutLens) & {
    condition: Omit<Datasworn.TriggerActionRollCondition, "roll_options">[];
  }
> {
  const availableRollables = actionContext.rollables;

  const { value: stat } = await CustomSuggestModal.selectWithUserEntry(
    app,
    availableRollables
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
    (m) => `${m.definition.label}: ${m.value ?? "unknown"}`,
    (input, el) => {
      el.setText(`Use custom meter '${input}'`);
    },
    ({ item }, el) => {
      if (item.condition.length > 0) {
        el.createEl("small", {
          text: `Trigger: ${item.condition.flatMap((cond) => cond.text ?? []).join("; ")}`,
          cls: "forged-suggest-hint",
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
