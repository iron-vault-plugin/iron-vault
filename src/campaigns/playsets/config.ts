import { Datasworn } from "@datasworn/core";
import { sameValueElementsInArray } from "utils/arrays";
import { z } from "zod";
import { STANDARD_PLAYSET_DEFNS } from "./standard";

export const TAG_KEY_REGEX = /(?:[\w_]+)\.(?:[\w_]+)/;
export const ONLY_TAG_KEY_REGEX = /^(?<pkgid>[\w_]+)\.(?<tagid>[\w_]+)$/;
export const TAG_REGEX = new RegExp(
  String.raw`${TAG_KEY_REGEX.source}\s*=\s*(?:true|false|\d+|"[^"]*")`,
);

export const PLAYSET_REGEX = new RegExp(
  String.raw`^\s*(?<negate>!?)\s*(?<kind>(?:[-\w]+|\*)):(?<path>[-\w*/]+)(?:\s+\[(?<tags>${TAG_REGEX.source}(?:\s*&\s*${TAG_REGEX.source})*)\])?$`,
);

export const PlaysetLinesSchema = z
  .array(z.string())
  .superRefine((lines, ctx) => {
    try {
      PlaysetConfig.parse(lines);
    } catch (e) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Invalid playset line: ${e}`,
      });
    }
  });

export enum Determination {
  Exclude = "exclude",
  Include = "include",
}

export class InvalidPlaysetLineError extends Error {}

function parse(
  line: string,
): [RegExp, Determination, PlaysetTagsFilter | undefined] | null {
  const result = line.match(PLAYSET_REGEX);

  if (!result || !result.groups) return null;

  const determination =
    result.groups.negate == "!" ? Determination.Exclude : Determination.Include;

  if (result.groups.kind == "rules_package") {
    return [
      new RegExp(String.raw`^${result.groups.path}$`),
      determination,
      undefined,
    ];
  }

  const kindRegex =
    result.groups.kind == "*"
      ? String.raw`(?:[-\w.]+:)?`
      : String.raw`${result.groups.kind}(\.[-\w]+)*:`;

  const pathRegex = result.groups.path.replaceAll(
    /\/?\*\*\/?|\*/g,
    (pattern) => {
      switch (pattern) {
        case "**":
          return String.raw`[-\w/]*`;
        case "/**":
          return String.raw`(?:/[-\w/]*)?`;
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
    String.raw`^(?:${kindRegex})(?:${pathRegex})(\.[-\w]+)*$`,
  );

  return [
    fullRegex,
    determination,
    result.groups.tags
      ? PlaysetTagsFilter.fromString(result.groups.tags)
      : undefined,
  ];
}

function parseTagKey(input: string): [string, string] {
  const result = input.match(ONLY_TAG_KEY_REGEX);
  if (!result)
    throw new InvalidPlaysetLineError(
      `'${input}' not a valid tag key expression`,
    );
  return [result.groups!["pkgid"], result.groups!["tagid"]];
}

export interface IPlaysetCondition {
  match(id: string, obj: { tags?: Datasworn.Tags }): boolean;
  equals(other: IPlaysetCondition): boolean;
}

export class PlaysetTagFilter implements IPlaysetCondition {
  static fromString(input: string): PlaysetTagFilter {
    const [keyExpr, valueExpr] = input.split(/\s*=\s*/);
    const key = parseTagKey(keyExpr);
    let value: boolean | number | string;
    if (valueExpr == "true") {
      value = true;
    } else if (valueExpr == "false") {
      value = false;
    } else {
      const num = Number.parseInt(valueExpr);
      value = Number.isNaN(num)
        ? valueExpr.slice(1, valueExpr.length - 1)
        : num;
    }
    return new this(key[0], key[1], value);
  }

  toString(): string {
    return `${this.packageId}.${this.tagId}=${this.targetValue}`;
  }

  constructor(
    readonly packageId: string,
    readonly tagId: string,
    readonly targetValue: Datasworn.Tag,
  ) {}

  match(id: string, obj: { tags?: Datasworn.Tags }): boolean {
    return sameTagValue(
      this.targetValue,
      obj.tags?.[this.packageId]?.[this.tagId],
    );
  }

  equals(other: IPlaysetCondition): boolean {
    return (
      other instanceof PlaysetTagFilter &&
      this.packageId === other.packageId &&
      this.tagId === other.tagId &&
      sameTagValue(this.targetValue, other.targetValue)
    );
  }
}

export class PlaysetTagsFilter implements IPlaysetCondition {
  readonly filters: ReadonlyArray<PlaysetTagFilter>;

  /** Warning: Assumes that string was matched against regex already. */
  static fromString(input: string): PlaysetTagsFilter {
    return new PlaysetTagsFilter(
      input.split(/\s*&\s*/).map((expr) => {
        return PlaysetTagFilter.fromString(expr);
      }),
    );
  }

  toString(): string {
    return `${this.filters.map((f) => f.toString()).join(",")}`;
  }

  constructor(filters: Iterable<PlaysetTagFilter>) {
    this.filters = [...filters];
  }

  match(id: string, obj: { tags?: Datasworn.Tags }): boolean {
    return this.filters.every((filter) => filter.match(id, obj));
  }

  equals(other: IPlaysetCondition): boolean {
    return (
      other instanceof PlaysetTagsFilter &&
      this.filters.length == other.filters.length &&
      this.filters.every((filter) =>
        other.filters.find((otherFilter) => filter.equals(otherFilter)),
      )
    );
  }
}

function sameTagValue(
  left: Datasworn.Tag | undefined,
  right: Datasworn.Tag | undefined,
): boolean {
  return (
    typeof left === typeof right &&
    (left instanceof Array && right instanceof Array
      ? sameValueElementsInArray(left, right)
      : left === right)
  );
}

export interface IPlaysetLine {
  /** A playset line returns a determination if it has one, or null if it does not apply. */
  determine(id: string, obj: { tags?: Datasworn.Tags }): Determination | null;
  equals(other: IPlaysetConfig): boolean;
}

export class PlaysetGlobLine implements IPlaysetLine {
  static tryFromString(line: string): PlaysetGlobLine | null {
    const result = parse(line);
    return result && new this(...result);
  }

  static fromString(line: string): PlaysetGlobLine {
    const result = this.tryFromString(line);
    if (!result)
      throw new InvalidPlaysetLineError(
        `'${line} is not a valid playset glob line.`,
      );
    return result;
  }

  constructor(
    readonly regex: RegExp,
    readonly determination: Determination,
    readonly tags?: PlaysetTagsFilter,
  ) {}

  determine(id: string, obj: { tags?: Datasworn.Tags }): Determination | null {
    return this.match(id, obj) ? this.determination : null;
  }

  match(id: string, obj: { tags?: Datasworn.Tags }): boolean {
    return (
      !!id.match(this.regex) && (this.tags == null || this.tags.match(id, obj))
    );
  }

  equals(other: IPlaysetConfig): boolean {
    return (
      other instanceof PlaysetGlobLine &&
      other.determination === this.determination &&
      other.regex.source == this.regex.source &&
      ((other.tags == null && this.tags == null) ||
        (other.tags != null &&
          this.tags != null &&
          other.tags.equals(this.tags)))
    );
  }
}

const PLAYSET_INCLUDE_STATEMENT_REGEX = new RegExp(
  /^@include\((?<name>[-\w_]+)\)$/,
);

export class PlaysetIncludeLine implements IPlaysetLine {
  static tryFromString(input: string): PlaysetIncludeLine | null {
    const match = input.match(PLAYSET_INCLUDE_STATEMENT_REGEX);

    if (!match) return null;

    const name = match.groups!.name;
    if (name in STANDARD_PLAYSET_DEFNS) {
      return new this(
        name,
        PlaysetConfig.parse(STANDARD_PLAYSET_DEFNS[name].lines),
      );
    } else {
      throw new InvalidPlaysetLineError(
        `include statement references unknown playset '${name}'`,
      );
    }
  }

  constructor(
    readonly name: string,
    readonly included: IPlaysetConfig,
  ) {}

  determine(id: string, obj: { tags?: Datasworn.Tags }): Determination | null {
    return this.included.determine(id, obj);
  }
  equals(other: IPlaysetConfig): boolean {
    return (
      other instanceof PlaysetIncludeLine &&
      this.included.equals(other.included)
    );
  }
}

export interface IPlaysetConfig {
  determine(id: string, obj: { tags?: Datasworn.Tags }): Determination | null;
  equals(other: IPlaysetConfig): boolean;
}

export class PlaysetConfig implements IPlaysetConfig {
  constructor(readonly lines: IPlaysetLine[]) {}

  static parse(lines: string[]): PlaysetConfig {
    return new PlaysetConfig(
      lines.flatMap((line, index) => {
        if (line.trim().length == 0 || line.startsWith("#")) return [];

        const compiled =
          PlaysetGlobLine.tryFromString(line) ??
          PlaysetIncludeLine.tryFromString(line);
        if (!compiled) {
          throw new InvalidPlaysetLineError(
            `Line ${index + 1}: '${line}' is not a valid.`,
          );
        }
        return [compiled];
      }),
    );
  }

  static parseFile(data: string): PlaysetConfig {
    return this.parse(data.split(/\r\n|\r|\n/g));
  }

  determine(id: string, obj: { tags?: Datasworn.Tags }): Determination | null {
    // Find the last matching determination
    for (let index = this.lines.length - 1; index >= 0; index--) {
      const line = this.lines[index];
      const determination = line.determine(id, obj);
      if (determination != null) return determination;
    }

    return null;
  }

  equals(other: IPlaysetConfig): boolean {
    return (
      other instanceof PlaysetConfig &&
      this.lines.length === other.lines.length &&
      this.lines.every((thisLine, idx) => thisLine.equals(other.lines[idx]))
    );
  }
}

export class DefaultingPlaysetConfig implements IPlaysetConfig {
  constructor(
    readonly config: IPlaysetConfig,
    readonly fallbackDetermination: Determination,
  ) {}

  determine(id: string, obj: { tags?: Datasworn.Tags }): Determination | null {
    return this.config.determine(id, obj) ?? this.fallbackDetermination;
  }

  equals(other: IPlaysetConfig): boolean {
    return (
      other instanceof DefaultingPlaysetConfig &&
      this.config.equals(other.config) &&
      this.fallbackDetermination == other.fallbackDetermination
    );
  }
}

export class NullPlaysetConfig implements IPlaysetConfig {
  static readonly instance = new NullPlaysetConfig();

  determine(_id: string): Determination | null {
    return Determination.Include;
  }

  equals(other: IPlaysetConfig): boolean {
    return other instanceof NullPlaysetConfig;
  }
}
