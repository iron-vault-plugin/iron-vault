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

export enum DieKind {
  Action = "action",
  Challenge1 = "challenge1",
  Challenge2 = "challenge2",
  Oracle = "oracle",
  Cursed = "cursed",
}

export class Dice {
  static fromDiceString(
    spec: string,
    plugin?: IronVaultPlugin,
    kind?: DieKind,
  ): Dice {
    const parsed = spec.match(DICE_REGEX);
    if (parsed == null) {
      throw new Error(`invalid dice spec ${spec}`);
    }
    return new Dice(
      Number.parseInt(parsed[1]),
      Number.parseInt(parsed[2]),
      plugin,
      kind,
    );
  }

  constructor(
    public readonly count: number,
    public readonly sides: number,
    public readonly plugin?: IronVaultPlugin,
    public readonly kind?: DieKind,
  ) {}

  async roll(displayDice: boolean): Promise<number> {
    if (displayDice && this.plugin) {
      const res = await this.plugin.diceOverlay.roll({
        qty: this.count,
        sides: this.sides,
        themeColor: this.themeColor,
      });
      return res.reduce(
        (acc, roll) =>
          // @3d-dice return "0" for percentile dice when when both are "0"/"00", instead of "100"
          acc + (roll.sides === 100 && roll.value === 0 ? 100 : roll.value),
        0,
      );
    } else {
      let total = 0;
      for (let i = 0; i < this.count; i++) {
        total += randomInt(1, this.sides);
      }
      return total;
    }
  }

  get themeColor(): string | undefined {
    switch (this.kind) {
      case DieKind.Action:
        return this.plugin?.settings.actionDieColor;
      case DieKind.Challenge1:
        return this.plugin?.settings.challengeDie1Color;
      case DieKind.Challenge2:
        return this.plugin?.settings.challengeDie2Color;
      case DieKind.Oracle:
        return this.plugin?.settings.oracleDiceColor;
      case DieKind.Cursed:
        return this.plugin?.settings.cursedDieColor;
      default:
        return;
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
