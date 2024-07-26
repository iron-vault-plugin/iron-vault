import { z } from "zod";

export const PLAYSET_REGEX =
  /^\s*(?<negate>!?)\s*(?<kind>(?:[-\w]+|\*)):(?<path>[-\w*/]+)$/;

export const PlaysetLinesSchema = z.array(
  z.string().regex(PLAYSET_REGEX, "must be valid playset line"),
);

export enum Determination {
  Exclude = "exclude",
  Include = "include",
}

export class InvalidPlaysetLineError extends Error {}

function parse(line: string): [RegExp, Determination] {
  const result = line.match(PLAYSET_REGEX);

  if (!result || !result.groups)
    throw new InvalidPlaysetLineError(`invalid playset line '${line}'`);

  const determination =
    result.groups.negate == "!" ? Determination.Exclude : Determination.Include;

  const kindRegex =
    result.groups.kind == "*"
      ? String.raw`[-\w.]+`
      : String.raw`${result.groups.kind}(\.[-\w]+)*`;

  const pathRegex = result.groups.path.replaceAll(
    /\/?\*\*\/?|\*/g,
    (pattern) => {
      switch (pattern) {
        case "**":
          return String.raw`[-\w/]*`;
        case "/**":
          return String.raw`/[-\w/]*`;
        case "**/":
          return String.raw`([-\w]+/)*`;
        case "/**/":
          return String.raw`/([-\w]+/)*`;
        case "*":
          return String.raw`[-\w]*`;
        default:
          throw new Error("illegal pattern");
      }
    },
  );

  const fullRegex = new RegExp(
    String.raw`^${kindRegex}:${pathRegex}(\.[-\w]+)*$`,
  );

  return [fullRegex, determination];
}

export class PlaysetLine {
  readonly regex: RegExp;
  readonly determination: Determination;

  constructor(readonly line: string) {
    const [regex, determination] = parse(line);
    this.regex = regex;
    this.determination = determination;
  }

  [Symbol.match](str: string): RegExpMatchArray | null {
    return this.regex[Symbol.match](str);
  }

  equals(other: PlaysetLine): boolean {
    return (
      other.determination === this.determination &&
      other.regex.source == this.regex.source
    );
  }
}

export interface IPlaysetConfig {
  determine(id: string): Determination;
  equals(other: IPlaysetConfig): boolean;
}

export class PlaysetConfig implements IPlaysetConfig {
  constructor(readonly lines: PlaysetLine[]) {}

  static parse(lines: string[]): PlaysetConfig {
    return new PlaysetConfig(lines.map((line) => new PlaysetLine(line)));
  }

  static parseFile(data: string): PlaysetConfig {
    return this.parse(
      data
        .split(/\r\n|\r|\n/g)
        .filter((line) => line.trim().length > 0 && !line.startsWith("#")),
    );
  }

  determine(id: string): Determination {
    // Find the last matching determination
    for (let index = this.lines.length - 1; index >= 0; index--) {
      const line = this.lines[index];
      if (id.match(line)) {
        return line.determination;
      }
    }

    return Determination.Exclude;
  }

  equals(other: IPlaysetConfig): boolean {
    return (
      other instanceof PlaysetConfig &&
      this.lines.length === other.lines.length &&
      this.lines.every((thisLine, idx) => thisLine.equals(other.lines[idx]))
    );
  }
}

export class NullPlaysetConfig implements IPlaysetConfig {
  static readonly instance = new NullPlaysetConfig();

  determine(_id: string): Determination {
    return Determination.Include;
  }

  equals(other: IPlaysetConfig): boolean {
    return other instanceof NullPlaysetConfig;
  }
}
