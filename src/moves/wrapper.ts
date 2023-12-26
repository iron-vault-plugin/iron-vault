import {
  moveIsAction,
  moveIsProgress,
  type ActionMoveDescription,
  type MoveDescription,
  type ProgressMoveDescription,
} from "./desc";

export enum RollResult {
  StrongHit,
  WeakHit,
  Miss,
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

export class ActionMoveWrapper extends MoveWrapper<ActionMoveDescription> {
  public get score(): number {
    return Math.min(this.move.action + this.move.statVal + this.move.adds, 10);
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
