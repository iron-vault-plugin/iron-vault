export function randomInt(min: number, max: number): number {
  const randomBuffer = new Uint32Array(1);

  crypto.getRandomValues(randomBuffer);

  const randomNumber = randomBuffer[0] / (4294967295 + 1);
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(randomNumber * (max - min + 1) + min);
}

const DICE_REGEX = /^(\d+)d(\d+)$/;

export class Dice {
  static fromDiceString(spec: string): Dice {
    const parsed = spec.match(DICE_REGEX);
    if (parsed == null) {
      throw new Error(`invalid dice spec ${spec}`);
    }
    return new Dice(Number.parseInt(parsed[1]), Number.parseInt(parsed[2]));
  }

  constructor(
    public readonly count: number,
    public readonly sides: number,
  ) {}

  roll(): number {
    let total = 0;
    for (let i = 0; i < this.count; i++) {
      total += randomInt(1, this.sides);
    }
    return total;
  }

  maxRoll(): number {
    return this.count * this.sides;
  }
}
