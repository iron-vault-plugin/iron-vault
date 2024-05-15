import {
  Move,
  MoveActionRoll,
  MoveProgressRoll,
  TriggerActionRollCondition,
} from "@datasworn/core";
import ForgedPlugin from "index";
import {
  type App,
  type Editor,
  type FuzzyMatch,
  type MarkdownView,
} from "obsidian";
import { MeterCommon } from "rules/ruleset";
import { InfoModal } from "utils/ui/info";
import { CharacterContext } from "../../character-tracker";
import {
  momentumOps,
  movesReader,
  rollablesReader,
} from "../../characters/lens";
import { type Datastore } from "../../datastore";
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

interface ActionContext {
  readonly moves: Move[];
  readonly rollables: {
    key: string;
    value?: number | undefined;
    definition: MeterCommon;
  }[];
  readonly momentum?: number;
}

class NoCharacterActionConext implements ActionContext {
  constructor(public readonly datastore: Datastore) {}

  get moves(): Move[] {
    return this.datastore.moves;
  }

  get rollables(): {
    key: string;
    value?: number | undefined;
    definition: MeterCommon;
  }[] {
    return Object.entries(this.datastore.ruleset.stats).map(([key, stat]) => ({
      key,
      definition: stat,
    }));
  }

  get momentum() {
    return undefined;
  }
}

class CharacterActionContext implements ActionContext {
  constructor(
    public readonly datastore: Datastore,
    public readonly characterPath: string,
    public readonly characterContext: CharacterContext,
  ) {}

  get moves() {
    const characterMoves = movesReader(
      this.characterContext.lens,
      this.datastore.index,
    )
      .get(this.characterContext.character)
      .expect("unexpected failure finding assets for moves");

    return this.datastore.moves.concat(characterMoves);
  }

  get rollables(): { key: string; value?: number; definition: MeterCommon }[] {
    return rollablesReader(
      this.characterContext.lens,
      this.datastore.index,
    ).get(this.characterContext.character);
  }

  get momentum() {
    return this.characterContext.lens.momentum.get(
      this.characterContext.character,
    );
  }
}

async function determineCharacterActionContext(
  plugin: ForgedPlugin,
): Promise<ActionContext | undefined> {
  if (plugin.settings.useCharacterSystem) {
    try {
      const [characterPath, characterContext] =
        plugin.characters.activeCharacter();
      return new CharacterActionContext(
        plugin.datastore,
        characterPath,
        characterContext,
      );
    } catch (e) {
      // TODO: probably want to show character parse errors in full glory
      await InfoModal.show(
        plugin.app,
        `An error occurred while finding your active character.\n\n${e}`,
      );
      return undefined;
    }
  } else {
    return new NoCharacterActionConext(plugin.datastore);
  }
}

export async function runMoveCommand(
  plugin: ForgedPlugin,
  editor: Editor,
  view: MarkdownView,
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

  const allMoves = context.moves.filter(
    (move) =>
      move.roll_type == "action_roll" || move.roll_type == "progress_roll",
  );

  const move = await promptForMove(
    plugin.app,
    allMoves.sort((a, b) => a.name.localeCompare(b.name)),
  );

  const moveRenderer: (move: MoveDescription) => void = getMoveRenderer(
    plugin.settings.moveBlockFormat,
    editor,
  );

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

function suggestedRollablesForMove(
  move: MoveActionRoll,
): Record<string, Array<Omit<TriggerActionRollCondition, "roll_options">>> {
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
  return suggestedRollables;
}

async function handleActionRoll(
  actionContext: ActionContext,
  app: App,
  move: MoveActionRoll,
) {
  const suggestedRollables = suggestedRollablesForMove(move);
  const availableRollables = actionContext.rollables;

  // TODO: add support for entering custom rollable name
  const stat = await CustomSuggestModal.select(
    app,
    availableRollables
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
            (b.value ?? 0) - (a.value ?? 0) ||
            a.definition.label.localeCompare(b.definition.label)
          );
        }
      }),
    (m) => `${m.definition.label}: ${m.value ?? "unknown"}`,
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
      move as MoveActionRoll,
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
