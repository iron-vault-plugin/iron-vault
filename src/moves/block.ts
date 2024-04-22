import { Move } from "@datasworn/core";
import { Datastore } from "datastore";
import {
  MarkdownRenderChild,
  MarkdownRenderer,
  parseYaml,
  type App,
} from "obsidian";
import ForgedPlugin from "../index";
import {
  MoveDescriptionSchema,
  moveIsAction,
  moveIsProgress,
  type ActionMoveDescription,
  type MoveDescription,
  type ProgressMoveDescription,
} from "./desc";
import {
  ActionMoveWrapper,
  MoveWrapper,
  ProgressMoveWrapper,
  RollResult,
  formatRollResult,
  lookupOutcome,
} from "./wrapper";

export function registerMoveBlock(plugin: ForgedPlugin): void {
  plugin.registerMarkdownCodeBlockProcessor("move", async (source, el, ctx) => {
    const doc = parseYaml(source);
    const validatedMove = MoveDescriptionSchema.safeParse(doc);

    if (validatedMove.success) {
      ctx.addChild(
        new MoveMarkdownRenderChild(
          el,
          plugin.app,
          ctx.sourcePath,
          doc,
          plugin.datastore,
        ),
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
  protected readonly moveDefinition?: Move;

  constructor(
    containerEl: HTMLElement,
    protected readonly app: App,
    protected readonly sourcePath: string,
    protected readonly doc: MoveDescription,
    protected readonly datastore: Datastore,
  ) {
    super(containerEl);

    const moves = datastore.moves.filter((move) => move.name === doc.name);
    if (moves.length != 1) {
      console.warn(
        "Expected only one move named %s, found %d: %o",
        doc.name,
        moves.length,
        moves,
      );
      this.moveDefinition = undefined;
    } else {
      this.moveDefinition = moves[0];
    }
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
    let display = `> [!${this.calloutForResult(wrap.result())}] ${move.name}: ${
      move.stat
    } + ${move.adds}: ${this.labelForResult(wrap)}
> ${move.action} + ${move.statVal} + ${move.adds} = ${
      move.action + move.statVal + move.adds
    }
> vs ${move.challenge1} and ${move.challenge2}
>`;
    if (move.burn) {
      display += ` burned momentum (${move.burn.orig} -> ${
        move.burn.reset
      }) to upgrade from ${formatRollResult(wrap.originalResult())}\n>`;
    }

    if (this.moveDefinition?.outcomes) {
      display += `\n>\n> ${lookupOutcome(wrap.result(), this.moveDefinition.outcomes).text}\n>`;
    }

    return display;
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
