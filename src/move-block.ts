import {
  MarkdownRenderer,
  type Plugin,
  parseYaml,
  MarkdownRenderChild,
  type App,
} from "obsidian";
import {
  MoveDescriptionSchema,
  type ActionMoveDescription,
  type MoveDescription,
  type ProgressMoveDescription,
} from "./move-desc";

export function moveIsAction(
  move: MoveDescription,
): move is ActionMoveDescription {
  return (move as ActionMoveDescription).action !== undefined;
}

export function moveIsProgress(
  move: MoveDescription,
): move is ActionMoveDescription {
  return (move as ProgressMoveDescription).progressTrack !== undefined;
}

enum RollResult {
  StrongHit,
  WeakHit,
  Miss,
}

abstract class MoveWrapper<T extends MoveDescription> {
  public readonly move: T;

  public constructor(move: T) {
    this.move = move;
  }

  abstract get score(): number;

  public isMatch(): boolean {
    return this.move.challenge1 === this.move.challenge2;
  }

  public result(): RollResult {
    const move = this.move;
    const actionScore = this.score;

    if (actionScore > move.challenge1 && actionScore > move.challenge2) {
      return RollResult.StrongHit;
    } else if (
      actionScore <= move.challenge1 &&
      actionScore <= move.challenge2
    ) {
      return RollResult.Miss;
    } else {
      return RollResult.WeakHit;
    }
  }
}

class ActionMoveWrapper extends MoveWrapper<ActionMoveDescription> {
  public get score(): number {
    return Math.min(this.move.action + this.move.statVal + this.move.adds, 10);
  }
}

class ProgressMoveWrapper extends MoveWrapper<ProgressMoveDescription> {
  public get score(): number {
    return Math.floor(this.move.progressTicks / 4);
  }
}

export function registerMoveBlock(plugin: Plugin): void {
  plugin.registerMarkdownCodeBlockProcessor("move", async (source, el, ctx) => {
    const doc = parseYaml(source);
    const validatedMove = MoveDescriptionSchema.safeParse(doc);

    if (validatedMove.success) {
      ctx.addChild(
        new MoveMarkdownRenderChild(el, plugin.app, ctx.sourcePath, doc),
      );
    } else {
      el.createEl("pre", {
        text:
          "Error parsing move\n" + JSON.stringify(validatedMove.error.format()),
      });
    }
  });
}

class MoveMarkdownRenderChild extends MarkdownRenderChild {
  app: App;
  doc: MoveDescription;
  sourcePath: string;

  constructor(
    containerEl: HTMLElement,
    app: App,
    sourcePath: string,
    doc: MoveDescription,
  ) {
    super(containerEl);
    this.app = app;
    this.sourcePath = sourcePath;
    this.doc = doc;
  }

  calloutForResult(result: RollResult): string {
    switch (result) {
      case RollResult.Miss:
        return "challenge-miss";
      case RollResult.StrongHit:
        return "challenge-strong";
      case RollResult.WeakHit:
        return "challenge-weak";
    }
  }

  labelForResult<T extends MoveDescription>(wrap: MoveWrapper<T>): string {
    switch (wrap.result()) {
      case RollResult.Miss:
        return "Miss" + (wrap.isMatch() ? " with Match" : "");
      case RollResult.StrongHit:
        return "Strong Hit" + (wrap.isMatch() ? " with Match" : "");
      case RollResult.WeakHit:
        return "Weak Hit";
    }
  }

  template(move: MoveDescription): string {
    if (moveIsAction(move)) {
      return this.actionTemplate(move);
    } else if (moveIsProgress(move)) {
      return this.progressTemplate(move);
    }
    throw new Error("What kind of bizarre move is this?");
  }

  actionTemplate(move: ActionMoveDescription): string {
    const wrap = new ActionMoveWrapper(move);
    return `> [!${this.calloutForResult(wrap.result())}] ${move.name}: ${
      move.stat
    } + ${move.adds}: ${this.labelForResult(wrap)}
> ${move.action} + ${move.statVal} + ${move.adds} = ${
      move.action + move.statVal + move.adds
    }
> vs ${move.challenge1} and ${move.challenge2}
>`;
  }

  progressTemplate(move: ProgressMoveDescription): string {
    const wrap = new ProgressMoveWrapper(move);
    return `> [!${this.calloutForResult(wrap.result())}] ${move.name}: ${
      move.progressTrack
    }
> ${wrap.score} (${move.progressTicks} ticks)
> vs ${move.challenge1} and ${move.challenge2}
>`;
  }

  async onload(): Promise<void> {
    await MarkdownRenderer.render(
      this.app,
      this.template(this.doc),
      this.containerEl,
      this.sourcePath,
      this,
    );
  }
}
