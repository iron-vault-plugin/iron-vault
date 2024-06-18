import IronVaultPlugin from "index";

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
  static fromDiceString(spec: string, plugin?: IronVaultPlugin): Dice {
    const parsed = spec.match(DICE_REGEX);
    if (parsed == null) {
      throw new Error(`invalid dice spec ${spec}`);
    }
    return new Dice(
      Number.parseInt(parsed[1]),
      Number.parseInt(parsed[2]),
      plugin,
    );
  }

  constructor(
    public readonly count: number,
    public readonly sides: number,
    public readonly plugin?: IronVaultPlugin,
  ) {}

  async roll(): Promise<number> {
    if (this.plugin?.settings.graphicalDice) {
      const res = await this.plugin.diceOverlay.roll(
        `${this.count}d${this.sides}`,
      );
      return res.reduce((acc, roll) => acc + roll.value, 0);
    } else {
      let total = 0;
      for (let i = 0; i < this.count; i++) {
        total += randomInt(1, this.sides);
      }
      return total;
    }
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
