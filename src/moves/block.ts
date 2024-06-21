import { Datastore } from "datastore";
import { AnyDataswornMove } from "datastore/datasworn-indexer";
import { rootLogger } from "logger";
import { MarkdownRenderChild, MarkdownRenderer, type App } from "obsidian";
import IronVaultPlugin from "../index";
import {
  NoRollMoveDescription,
  moveIsAction,
  moveIsProgress,
  type ActionMoveDescription,
  type MoveDescription,
  type ProgressMoveDescription,
} from "./desc";
import { parseMoveBlock } from "./serde";
import {
  ActionMoveWrapper,
  MoveWrapper,
  ProgressMoveWrapper,
  RollResult,
  formatRollResult,
  lookupOutcome,
} from "./wrapper";

const logger = rootLogger.getLogger("moves/block");

export function registerMoveBlock(plugin: IronVaultPlugin): void {
  plugin.registerMarkdownCodeBlockProcessor("move", async (source, el, ctx) => {
    await plugin.datastore.waitForReady;
    const validatedMove = parseMoveBlock(source);

    if (validatedMove.isRight()) {
      const renderer = new MoveMarkdownRenderChild(
        el,
        plugin.app,
        ctx.sourcePath,
        validatedMove.value,
        plugin.datastore,
      );
      ctx.addChild(renderer);
      renderer.render();
    } else {
      el.createEl("pre", {
        text: `Error parsing move\n${validatedMove.error.toString()}\n${JSON.stringify(validatedMove.error.cause)}`,
      });
    }
  });
}

function formatAdds(adds: { amount: number; desc?: string }[]): string {
  if (adds.length == 0) {
    return "0";
  }
  return adds
    .map(({ amount, desc }) => `${amount}` + (desc ? `(${desc})` : ""))
    .join(" + ");
}

class MoveMarkdownRenderChild extends MarkdownRenderChild {
  protected readonly moveDefinition?: AnyDataswornMove;

  constructor(
    containerEl: HTMLElement,
    protected readonly app: App,
    protected readonly sourcePath: string,
    protected readonly doc: MoveDescription,
    protected readonly datastore: Datastore,
  ) {
    super(containerEl);

    const moves = [...datastore.moves.values()].filter(
      (move) => move.name === doc.name,
    );
    if (moves.length != 1) {
      logger.warn(
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

  labelForResult<T extends ActionMoveDescription | ProgressMoveDescription>(
    wrap: MoveWrapper<T>,
  ): string {
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
    } else {
      return this.noRollTemplate(move);
    }
  }

  actionTemplate(move: ActionMoveDescription): string {
    const wrap = new ActionMoveWrapper(move);
    let display = `> [!${this.calloutForResult(wrap.result())}] ${move.name}: ${
      move.stat
    } + ${wrap.totalAdds}: ${this.labelForResult(wrap)}
> ${move.action} + ${move.statVal} + ${formatAdds(move.adds)} = ${wrap.actionScore}
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

  noRollTemplate(move: NoRollMoveDescription): string {
    return `> [!challenge-strong] ${move.name}\n> \n`;
  }

  async onload(): Promise<void> {
    await this.render();
  }

  async render() {
    await MarkdownRenderer.render(
      this.app,
      this.template(this.doc),
      this.containerEl,
      this.sourcePath,
      this,
    );
  }
}
