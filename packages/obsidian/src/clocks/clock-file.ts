import { produce } from "immer";
import { CachedMetadata, TFile } from "obsidian";
import Result from "true-myth/result";
import { normalizeKeys } from "utils/zodutils";
import { z } from "zod";
import { IronVaultKind, PLUGIN_KIND_FIELD } from "../constants";
import { BaseIndexer, IndexOf, IndexUpdate } from "../indexer/indexer";
import { updater } from "../utils/update";
import { Clock } from "./clock";

export const clockOddsSchema = z.enum([
  "small chance",
  "unlikely",
  "50 50",
  "likely",
  "almost certain",
  "certain",
  "no roll",
]);

export const namedOddsSchema = clockOddsSchema.exclude(["no roll"]);

export type OddsTable = Record<z.infer<typeof namedOddsSchema>, number>;

export const STANDARD_ODDS: OddsTable = {
  "small chance": 10,
  unlikely: 25,
  "50 50": 50,
  likely: 75,
  "almost certain": 90,
  certain: 100,
};

export type ClockOdds = z.infer<typeof clockOddsSchema>;

const clockSchema = z
  .object({
    name: z.string(),
    segments: z.number().positive(),
    progress: z.number().nonnegative(),

    /** Default odds of advancing the clock. Choose 'no roll' if you do not wish to be prompted ever. */
    "default-odds": clockOddsSchema.optional(),

    tags: z
      .union([z.string().transform((arg) => [arg]), z.array(z.string())])
      .refine(
        (arg) => {
          const hasComplete = arg.includes("complete");
          const hasIncomplete = arg.includes("incomplete");
          return (
            (hasComplete && !hasIncomplete) || (hasIncomplete && !hasComplete)
          );
        },
        {
          message:
            "Tags must contain exactly one of 'incomplete' or 'complete'",
        },
      ),
  })
  .passthrough();

export const normalizedClockSchema = normalizeKeys(clockSchema);

export type ClockInputSchema = z.input<typeof clockSchema>;
export type ClockSchema = z.output<typeof clockSchema>;

export class ClockFileAdapter {
  private constructor(
    public readonly raw: Readonly<ClockSchema>,
    public readonly clock: Readonly<Clock>,
  ) {}

  get name(): string {
    return this.raw.name;
  }

  static newFromClock({
    name,
    clock,
    defaultOdds,
  }: {
    name: string;
    clock: Clock;
    defaultOdds: ClockOdds | undefined;
  }): Result<ClockFileAdapter, z.ZodError> {
    return this.create({
      name,
      segments: clock.segments,
      progress: clock.progress,
      "default-odds": defaultOdds,
      tags: !clock.active ? ["complete"] : ["incomplete"],
      [PLUGIN_KIND_FIELD]: IronVaultKind.Clock,
    } satisfies z.input<typeof clockSchema>);
  }

  static create(data: unknown): Result<ClockFileAdapter, z.ZodError> {
    const result = normalizedClockSchema.safeParse(data);
    if (result.success) {
      const raw = result.data;
      return Clock.create({
        name: raw.name,
        progress: raw.progress,
        segments: raw.segments,
        active: !raw.tags.includes("complete"),
      }).map((clock) => new this(raw, clock));
    } else {
      return Result.err(result.error);
    }
  }

  updatingClock(update: (clock: Clock) => Clock): ClockFileAdapter {
    return this.withClock(update(this.clock));
  }

  withClock(other: Clock): ClockFileAdapter {
    if (this.clock == other || this.clock.equals(other)) return this;
    return new ClockFileAdapter(
      produce(this.raw, (data) => {
        data.name = other.name;
        data.progress = other.progress;
        data.segments = other.segments;
        const [tagToRemove, tagToAdd] = !other.active
          ? ["incomplete", "complete"]
          : ["complete", "incomplete"];
        const removeIndex = data.tags.indexOf(tagToRemove);
        data.tags.splice(
          removeIndex,
          removeIndex > -1 ? 1 : 0,
          ...(data.tags.includes(tagToAdd) ? [] : [tagToAdd]),
        );
      }),
      other,
    );
  }

  /** Returns the normalized numeric default odds for this clock, or  */
  normalizedOdds(
    oddsTable: OddsTable = STANDARD_ODDS,
  ): number | "no roll" | undefined {
    const defaultOdds = this.raw["default-odds"];
    if (
      defaultOdds === undefined ||
      defaultOdds == "no roll" ||
      typeof defaultOdds == "number"
    ) {
      return defaultOdds;
    } else {
      return oddsTable[defaultOdds];
    }
  }
}

export class ClockIndexer extends BaseIndexer<ClockFileAdapter, z.ZodError> {
  readonly id = IronVaultKind.Clock;

  processFile(
    file: TFile,
    cache: CachedMetadata,
  ): IndexUpdate<ClockFileAdapter, z.ZodError> {
    return ClockFileAdapter.create(cache.frontmatter);
  }
}

// TODO: feels like this could be merged into some class that provides the same config to
//       ProgressIndexer
export const clockUpdater = updater<ClockFileAdapter>(
  (data) =>
    ClockFileAdapter.create(data).unwrapOrElse((e) => {
      throw new Error("could not parse", { cause: e });
    }),
  (tracker) => tracker.raw,
);

export type ClockIndex = IndexOf<ClockIndexer>;
