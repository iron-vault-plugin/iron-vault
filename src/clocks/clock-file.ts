import { produce } from "immer";
import { Index } from "indexer/index-impl";
import { CachedMetadata } from "obsidian";
import { normalizeKeys } from "utils/zodutils";
import { z } from "zod";
import { PLUGIN_KIND_FIELD } from "../constants";
import { BaseIndexer, IndexUpdate } from "../indexer/indexer";
import { Either, Left } from "../utils/either";
import { updater } from "../utils/update";
import { Clock } from "./clock";

const clockSchema = z
  .object({
    name: z.string(),
    segments: z.number().positive(),
    progress: z.number().nonnegative(),
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
  }: {
    name: string;
    clock: Clock;
  }): Either<z.ZodError, ClockFileAdapter> {
    return this.create({
      name,
      segments: clock.segments,
      progress: clock.progress,
      tags: !clock.active ? ["complete"] : ["incomplete"],
      [PLUGIN_KIND_FIELD]: KIND__CLOCK,
    } satisfies z.input<typeof clockSchema>);
  }

  static create(data: unknown): Either<z.ZodError, ClockFileAdapter> {
    const result = normalizedClockSchema.safeParse(data);
    if (result.success) {
      const raw = result.data;
      return Clock.create({
        progress: raw.progress,
        segments: raw.segments,
        active: !raw.tags.includes("complete"),
      }).map((clock) => new this(raw, clock));
    } else {
      return Left.create(result.error);
    }
  }

  updatingClock(update: (clock: Clock) => Clock): ClockFileAdapter {
    return this.withClock(update(this.clock));
  }

  withClock(other: Clock): ClockFileAdapter {
    if (this.clock == other || this.clock.equals(other)) return this;
    return new ClockFileAdapter(
      produce(this.raw, (data) => {
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
}

export const KIND__CLOCK = "clock";

export class ClockIndexer extends BaseIndexer<ClockFileAdapter, z.ZodError> {
  readonly id: string = KIND__CLOCK;

  processFile(
    path: string,
    cache: CachedMetadata,
  ): IndexUpdate<ClockFileAdapter, z.ZodError> {
    return ClockFileAdapter.create(cache.frontmatter);
  }
}

// TODO: feels like this could be merged into some class that provides the same config to
//       ProgressIndexer
export const clockUpdater = updater<ClockFileAdapter>(
  (data) => ClockFileAdapter.create(data).expect("could not parse"),
  (tracker) => tracker.raw,
);

export type ClockIndex = Index<ClockFileAdapter, z.ZodError>;
