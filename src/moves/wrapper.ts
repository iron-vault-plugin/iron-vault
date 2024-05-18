import { type Datasworn } from "@datasworn/core";
import {
  moveIsAction,
  moveIsProgress,
  type ActionMoveDescription,
  type MoveDescription,
  type ProgressMoveDescription,
} from "./desc";

export enum RollResult {
  Miss,
  WeakHit,
  StrongHit,
}

export function lookupOutcome(
  result: RollResult,
  outcomes: Datasworn.MoveOutcomes,
): Datasworn.MoveOutcome {
  switch (result) {
    case RollResult.Miss:
      return outcomes.miss;
    case RollResult.WeakHit:
      return outcomes.weak_hit;
    case RollResult.StrongHit:
      return outcomes.strong_hit;
  }
}

export enum MoveKind {
  Action,
  Progress,
}

export function wrapMove<T extends MoveDescription>(
  move: T,
): MoveWrapper<MoveDescription> {
  if (moveIsAction(move)) {
    return new ActionMoveWrapper(move);
  } else if (moveIsProgress(move)) {
    return new ProgressMoveWrapper(move);
  } else {
    throw new Error(`unexpected move type ${move}`);
  }
}

export abstract class MoveWrapper<T extends MoveDescription> {
  public readonly move: T;

  public constructor(move: T) {
    this.move = move;
  }

  abstract get score(): number;

  abstract get kind(): MoveKind;

  public isMatch(): boolean {
    return this.move.challenge1 === this.move.challenge2;
  }

  public result(): RollResult {
    const actionScore = this.score;
    return this.resultWithActionScore(actionScore);
  }

  public resultWithActionScore(actionScore: number): RollResult {
    const move = this.move;

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

export class ActionMoveWrapper extends MoveWrapper<ActionMoveDescription> {
  public get score(): number {
    return this.move.burn?.orig ?? this.actionScore;
  }

  /**
   * Gets the total value of all adds.
   */
  public get totalAdds(): number {
    return (this.move.adds ?? []).reduce((acc, { amount }) => acc + amount, 0);
  }

  public get actionScore(): number {
    return Math.min(this.move.action + this.move.statVal + this.totalAdds, 10);
  }

  public originalResult(): RollResult {
    return this.resultWithActionScore(this.actionScore);
  }

  public get kind(): MoveKind {
    return MoveKind.Action;
  }
}

export class ProgressMoveWrapper extends MoveWrapper<ProgressMoveDescription> {
  public get score(): number {
    return Math.floor(this.move.progressTicks / 4);
  }

  public get kind(): MoveKind {
    return MoveKind.Progress;
  }
}
export function formatRollResult(roll: RollResult): string {
  switch (roll) {
    case RollResult.StrongHit:
      return "Strong Hit";
    case RollResult.WeakHit:
      return "Weak Hit";
    case RollResult.Miss:
      return "Miss";
  }
}
