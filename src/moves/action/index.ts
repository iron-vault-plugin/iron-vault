import {
  Move,
  MoveActionRoll,
  MoveProgressRoll,
  TriggerActionRollCondition,
} from "@datasworn/core";
import { DataIndex } from "datastore/data-index";
import {
  type App,
  type Editor,
  type FuzzyMatch,
  type MarkdownView,
} from "obsidian";
import {
  CharacterContext,
  type CharacterTracker,
} from "../../character-tracker";
import {
  momentumOps,
  movesReader,
  rollablesReader,
} from "../../characters/lens";
import { type Datastore } from "../../datastore";
import { ForgedPluginSettings } from "../../settings/ui";
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
import { getMoveRenderer } from "./format";

enum MoveKind {
  Progress = "Progress",
  Action = "Action",
  Other = "Other",
}

function getMoveKind(move: Move): MoveKind {
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
        `unexpected roll type ${(move as Move).roll_type} on move id ${
          (move as Move).id
        }`,
      );
  }
}
const promptForMove = async (app: App, moves: Move[]): Promise<Move> =>
  await CustomSuggestModal.select(
    app,
    moves,
    (move) => move.name,
    ({ item: move }: FuzzyMatch<Move>, el: HTMLElement) => {
      const moveKind = getMoveKind(move);
      el.createEl("small", {
        text: `(${moveKind}) ${move.trigger.text}`,
        cls: "forged-suggest-hint",
      });
    },
  );

function processActionMove(
  move: Move,
  stat: string,
  statVal: number,
  adds: ActionMoveAdd[],
): ActionMoveDescription {
  return {
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
  move: Move,
  tracker: ProgressTrackWriterContext,
): ProgressMoveDescription {
  return {
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
  app: App,
  datastore: Datastore,
  progressContext: ProgressContext,
  characters: CharacterTracker,
  editor: Editor,
  view: MarkdownView,
  settings: ForgedPluginSettings,
): Promise<void> {
  if (view.file?.path == null) {
    console.error("No file for view. Why?");
    return;
  }

  const [characterPath, context] = characters.activeCharacter();

  const { character, lens } = context;

  const characterMoves = movesReader(lens, datastore.index)
    .get(character)
    .expect("unexpected failure finding assets for moves");

  const allMoves = datastore.moves
    .concat(characterMoves)
    .filter(
      (move) =>
        move.roll_type == "action_roll" || move.roll_type == "progress_roll",
    );

  const moveRenderer: (move: MoveDescription) => void = getMoveRenderer(
    settings.moveBlockFormat,
    editor,
  );

  const move = await promptForMove(
    app,
    allMoves.sort((a, b) => a.name.localeCompare(b.name)),
  );

  let moveDescription: MoveDescription;
  switch (move.roll_type) {
    case "action_roll": {
      moveDescription = await handleActionRoll(
        context,
        app,
        move,
        characterPath,
        datastore.index,
      );
      break;
    }
    case "progress_roll": {
      moveDescription = await handleProgressRoll(app, progressContext, move);
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

  moveRenderer(moveDescription);
}

async function handleProgressRoll(
  app: App,
  progressContext: ProgressContext,
  move: MoveProgressRoll,
): Promise<MoveDescription> {
  const progressTrack = await selectProgressTrack(
    progressContext,
    app,
    (prog) => prog.trackType == move.tracks.category && !prog.track.complete,
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

async function handleActionRoll(
  charContext: CharacterContext,
  app: App,
  move: MoveActionRoll,
  characterPath: string,
  dataIndex: DataIndex,
) {
  const { lens, character } = charContext;

  const suggestedRollables: Record<
    string,
    Array<Omit<TriggerActionRollCondition, "roll_options">>
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

  const stat = await CustomSuggestModal.select(
    app,
    rollablesReader(lens, dataIndex)
      .get(character)
      .map((meter) => {
        return { ...meter, condition: suggestedRollables[meter.key] ?? [] };
      })
      .sort((a, b) => {
        if (a.condition.length > 0 && b.condition.length == 0) {
          return -1;
        } else if (a.condition.length == 0 && b.condition.length > 0) {
          return 1;
        } else {
          return (
            b.value - a.value ||
            a.definition.label.localeCompare(b.definition.label)
          );
        }
      }),
    (m) => `${m.definition.label}: ${m.value ?? "missing (defaults to 0)"}`,
    ({ item }, el) => {
      if (item.condition.length > 0) {
        el.createEl("small", {
          text: `Trigger: ${item.condition.flatMap((cond) => cond.text ?? []).join("; ")}`,
          cls: "forged-suggest-hint",
        });
      }
    },
    move.trigger.text,
  );

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
  description = await checkForMomentumBurn(
    app,
    move as MoveActionRoll,
    wrapper,
    charContext,
  );
  // TODO: maybe this should be pulled up into the other function (even though it only
  // applies for action moves.
  if (description.burn) {
    await charContext.updater(
      vaultProcess(app, characterPath),
      (character, { lens }) => momentumOps(lens).reset(character),
    );
  }
  return description;
}
