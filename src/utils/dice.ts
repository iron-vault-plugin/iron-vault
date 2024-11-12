import { rootLogger } from "logger";

export function randomInt(min: number, max: number): number {
  const randomBuffer = new Uint32Array(1);

  crypto.getRandomValues(randomBuffer);

  const randomNumber = randomBuffer[0] / (4294967295 + 1);
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(randomNumber * (max - min + 1) + min);
}

const DICE_REGEX = /^(\d+)d(\d+)$/;

export enum DieKind {
  Action = "action",
  Challenge1 = "challenge1",
  Challenge2 = "challenge2",
  Oracle = "oracle",
  Cursed = "cursed",
}

const logger = rootLogger.getLogger("dice");

export class Dice {
  static fromDiceString(spec: string, kind?: DieKind): Dice {
    const parsed = spec.match(DICE_REGEX);
    if (parsed == null) {
      throw new Error(`invalid dice spec ${spec}`);
    }
    return new Dice(
      Number.parseInt(parsed[1]),
      Number.parseInt(parsed[2]),
      kind,
    );
  }

  constructor(
    public readonly count: number,
    public readonly sides: number,
    public readonly kind?: DieKind,
  ) {
    if (sides > 100 && sides % 100 == 0) {
      this.sides = 100;
      this.count = sides / 100;
      logger.debug(
        "Converted %dd%d to %dd%d",
        count,
        sides,
        this.count,
        this.sides,
      );
    }
  }

  roll(): number {
    let total = 0;
    for (let i = 0; i < this.count; i++) {
      total += randomInt(1, this.sides);
    }
    return total;
  }

  minRoll(): number {
    return this.count;
  }

  maxRoll(): number {
    return this.count * this.sides;
  }

  flip(roll: number): number {
    return this.maxRoll() - roll + 1;
  }

  [Symbol.toStringTag](): string {
    return `${this.count}d${this.sides}`;
  }
}
