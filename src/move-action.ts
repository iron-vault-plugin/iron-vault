import {
  type App,
  FuzzySuggestModal,
  type Editor,
  stringifyYaml,
  type FuzzyMatch,
  type MarkdownView,
  SuggestModal,
  prepareFuzzySearch,
  type SearchResult,
  sortSearchResults,
} from "obsidian";
import {
  type ActionMoveDescription,
  type ProgressMoveDescription,
  type MoveDescription,
} from "./move-desc";
import type CharacterTracker from "./character";
import { type Move, type Datastore } from "./datastore";

class CancelError extends Error {}

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

function processMatches(
  text: string,
  search: SearchResult,
  onPlain: (text: string) => void,
  onHighlighted: (text: string) => void,
): void {
  let nextChar = 0;
  for (const [start, end] of search.matches) {
    if (start - nextChar > 0) {
      onPlain(text.slice(nextChar, start));
    }
    onHighlighted(text.slice(start, end));
    nextChar = end;
  }
  const remainder = text.slice(nextChar);
  if (remainder.length > 0) {
    onPlain(remainder);
  }
}

class MoveSuggestModal extends SuggestModal<FuzzyMatch<Move>> {
  private resolved: boolean = false;
  private readonly moves: Move[];
  private readonly onSelect: (move: Move) => void;
  private readonly onCancel: () => void;

  static async select(app: App, moves: Move[]): Promise<Move> {
    return await new Promise((resolve, reject) => {
      new this(app, moves, resolve, reject).open();
    });
  }

  constructor(
    app: App,
    moves: Move[],
    onSelect: (move: Move) => void,
    onCancel: () => void,
  ) {
    super(app);
    this.moves = moves;
    this.onSelect = onSelect;
    this.onCancel = onCancel;
  }

  getSuggestions(
    query: string,
  ): Array<FuzzyMatch<Move>> | Promise<Array<FuzzyMatch<Move>>> {
    const fuzzyScore = prepareFuzzySearch(query);
    const results = this.moves.flatMap((move) => {
      const match = fuzzyScore(move.Title.Standard);
      return match != null
        ? [
            {
              item: move,
              match,
            },
          ]
        : [];
    });
    sortSearchResults(results);
    return results;
  }

  renderSuggestion(
    { item: move, match }: FuzzyMatch<Move>,
    el: HTMLElement,
  ): void {
    el.createDiv(undefined, (div) => {
      processMatches(
        move.Title.Standard,
        match,
        (text) => {
          div.appendText(text);
        },
        (text) => {
          div.createEl("strong", { text });
        },
      );
    });
    // el.createEl("div", { text: move.item.Title.Standard });
    const moveKind = getMoveKind(move);
    el.createEl("small", { text: `(${moveKind}) ${move.Trigger.Text}` });
  }

  selectSuggestion(
    value: FuzzyMatch<Move>,
    evt: MouseEvent | KeyboardEvent,
  ): void {
    console.assert(!this.resolved, "selectSuggestion called more than once");
    this.resolved = true;
    super.selectSuggestion(value, evt);
  }

  onChooseSuggestion(
    item: FuzzyMatch<Move>,
    _evt: MouseEvent | KeyboardEvent,
  ): void {
    console.assert(this.resolved, "expected to already have been resolved");
    console.log(item);
    this.onSelect(item.item);
  }

  onClose(): void {
    super.onClose();
    console.log("closed");
    if (!this.resolved) {
      this.onCancel();
    }
  }
}

class ListSelectModal<T> extends FuzzySuggestModal<T> {
  resolved: boolean;
  resolve: (item: T) => void;
  reject: (reason?: any) => void;
  items: T[];
  itemText: (item: T) => string;

  constructor(
    app: App,
    items: T[],
    itemText: (item: T) => string,
    resolve: (item: T) => void,
    reject: (reason?: any) => void,
  ) {
    super(app);
    this.resolve = resolve;
    this.items = items;
    this.itemText = itemText;
    this.resolved = false;
    this.reject = reject;
  }

  getItems(): T[] {
    return this.items;
  }

  getItemText(item: T): string {
    return this.itemText(item);
  }

  selectSuggestion(
    value: FuzzyMatch<T>,
    evt: MouseEvent | KeyboardEvent,
  ): void {
    console.assert(!this.resolved, "selectSuggestion called more than once");
    this.resolved = true;
    super.selectSuggestion(value, evt);
  }

  onChooseItem(item: T, evt: MouseEvent | KeyboardEvent): void {
    console.assert(this.resolved, "onChooseItem called without resolve");
    this.resolve(item);
  }

  onClose(): void {
    super.onClose();
    if (!this.resolved) {
      this.reject(new CancelError());
    }
  }
}

async function chooseItem<T>(
  app: App,
  items: T[],
  itemText: (item: T) => string,
): Promise<T> {
  return await new Promise((resolve, reject) => {
    const modal = new ListSelectModal(app, items, itemText, resolve, reject);
    modal.open();
  });
}

function randomInt(min: number, max: number): number {
  const randomBuffer = new Uint32Array(1);

  crypto.getRandomValues(randomBuffer);

  const randomNumber = randomBuffer[0] / (0xffffffff + 1);
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(randomNumber * (max - min + 1) + min);
}

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

  const move = await MoveSuggestModal.select(
    app,
    datastore.moves.sort((a, b) =>
      a.Title.Standard.localeCompare(b.Title.Standard),
    ),
    // (m) => m.Title.Standard,
  );
  const moveKind = getMoveKind(move);
  if (moveKind === MoveKind.Action) {
    const stat = await chooseItem(
      app,
      Object.values(character.measures),
      (m) => `${m.name}: ${m.value ?? "missing (defaults to 0)"}`,
    );
    const adds = await chooseItem(
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
    const progressTrack = await chooseItem(
      app,
      ["do something", "a real great vow"],
      (text) => text,
    );
    const description = processProgressMove(move, progressTrack);
    editor.replaceSelection(moveTemplate(description));
  }
}
