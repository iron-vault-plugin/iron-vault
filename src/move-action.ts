import { Move } from "@datasworn/core";
import {
  stringifyYaml,
  type App,
  type Editor,
  type FuzzyMatch,
  type MarkdownView,
} from "obsidian";
import { IronswornCharacterMetadata } from "./character";
import { type CharacterTracker } from "./character-tracker";
import { type Datastore } from "./datastore";
import {
  type ActionMoveDescription,
  type MoveDescription,
  type ProgressMoveDescription,
} from "./move-desc";
import { randomInt } from "./utils/dice";
import { CustomSuggestModal } from "./utils/suggest";

enum MoveKind {
  Progress = "Progress",
  Action = "Action",
  Other = "Other",
}

// interface BaseMoveSpecifier {
//   move: Move;
//   kind: MoveKind;
// }

// interface ProgressMoveSpecifier extends BaseMoveSpecifier {
//   kind: MoveKind.Progress;
//   progressTrack: string;
// }

// interface ActionMoveSpecifier extends BaseMoveSpecifier {
//   kind: MoveKind.Action;
//   stat: string;
// }

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
    ({ item: move, match }: FuzzyMatch<Move>, el: HTMLElement) => {
      const moveKind = getMoveKind(move);
      el.createEl("small", { text: `(${moveKind}) ${move.trigger.text}` });
    },
  );

function processActionMove(
  move: Move,
  stat: string,
  statVal: number,
  adds: number,
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
  track: string,
): ProgressMoveDescription {
  return {
    name: move.name,
    progressTrack: track,
    // todo: fetch val
    progressTicks: randomInt(1, 40),
    challenge1: randomInt(1, 10),
    challenge2: randomInt(1, 10),
  };
}

function moveTemplate(move: MoveDescription): string {
  return `\`\`\`move\n${stringifyYaml(move)}\n\`\`\`\n\n`;
}

export async function runMoveCommand(
  app: App,
  datastore: Datastore,
  tracker: CharacterTracker,
  editor: Editor,
  view: MarkdownView,
): Promise<void> {
  if (view.file?.path == null) {
    console.error("No file for view. Why?");
    return;
  }

  const characters = tracker.characters;
  if (characters.size === 0) {
    console.error("No characters found");
    return;
  }
  const [character] = characters.values();

  const allMoves = datastore.moves.concat(
    character.as(IronswornCharacterMetadata).moves,
  );

  const move = await promptForMove(
    app,
    allMoves.sort((a, b) => a.name.localeCompare(b.name)),
  );
  const moveKind = getMoveKind(move);
  if (moveKind === MoveKind.Action) {
    const measures = character.as(IronswornCharacterMetadata).measures;
    const stat = await CustomSuggestModal.select(
      app,
      measures.entries(),
      (m) => `${m.definition.label}: ${m.value ?? "missing (defaults to 0)"}`,
    );
    const adds = await CustomSuggestModal.select(
      app,
      [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
      (n) => n.toString(10),
    );
    const description = processActionMove(
      move,
      stat.key,
      stat.value ?? 0,
      adds,
    );
    editor.replaceSelection(moveTemplate(description));
  } else if (moveKind === MoveKind.Progress) {
    const progressTrack = await CustomSuggestModal.select(
      app,
      ["do something", "a real great vow"],
      (text) => text,
    );
    const description = processProgressMove(move, progressTrack);
    editor.replaceSelection(moveTemplate(description));
  }
}
