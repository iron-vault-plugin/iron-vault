import {
  type App,
  type Editor,
  stringifyYaml,
  type FuzzyMatch,
  type MarkdownView,
} from "obsidian";
import {
  type ActionMoveDescription,
  type ProgressMoveDescription,
  type MoveDescription,
} from "./move-desc";
import type CharacterTracker from "./character";
import { type Move, type Datastore } from "./datastore";
import { CustomSuggestModal } from "./utils/suggest";
import { randomInt } from "./utils/dice";

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
  if (move["Progress move"] === true) return MoveKind.Progress;

  if (move.Outcomes != null) return MoveKind.Action;

  return MoveKind.Other;
}
const promptForMove = async (app: App, moves: Move[]): Promise<Move> =>
  await CustomSuggestModal.select(
    app,
    moves,
    (move) => move.Title.Standard,
    ({ item: move, match }: FuzzyMatch<Move>, el: HTMLElement) => {
      const moveKind = getMoveKind(move);
      el.createEl("small", { text: `(${moveKind}) ${move.Trigger.Text}` });
    },
  );

// const DICE_REGEX = /^(\d+)d(\d+)$/;

// function dice(str: string) {
//   const match = str.match(DICE_REGEX);
//   if (!match) {
//     throw new Error(`invalid dice expression: ${str}`);
//   }
// }

function processActionMove(
  move: Move,
  stat: string,
  statVal: number,
  adds: number,
): ActionMoveDescription {
  return {
    name: move.Title.Standard,
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
    name: move.Title.Standard,
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

  const move = await promptForMove(
    app,
    datastore.moves.sort((a, b) =>
      a.Title.Standard.localeCompare(b.Title.Standard),
    ),
  );
  const moveKind = getMoveKind(move);
  if (moveKind === MoveKind.Action) {
    const stat = await CustomSuggestModal.select(
      app,
      Object.values(character.measures),
      (m) => `${m.name}: ${m.value ?? "missing (defaults to 0)"}`,
    );
    const adds = await CustomSuggestModal.select(
      app,
      [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
      (n) => n.toString(10),
    );
    const description = processActionMove(
      move,
      stat.name,
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
