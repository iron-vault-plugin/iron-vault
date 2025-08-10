import { produce } from "immer";
import { Result } from "true-myth/result";
import { normalizeKeys } from "utils/zodutils";
import { ZodError, z } from "zod";
import { IronVaultKind, PLUGIN_KIND_FIELD } from "../constants";

export enum ChallengeRanks {
  /** 12 ticks per step */
  Troublesome = "troublesome",

  /** 8 ticks per step */
  Dangerous = "dangerous",

  /** 4 ticks per step */
  Formidable = "formidable",

  /** 2 ticks per step */
  Extreme = "extreme",

  /** 1 tick per step */
  Epic = "epic",
}

export const CHALLENGE_STEPS: Record<ChallengeRanks, number> = {
  [ChallengeRanks.Troublesome]: 12,
  [ChallengeRanks.Dangerous]: 8,
  [ChallengeRanks.Formidable]: 4,
  [ChallengeRanks.Extreme]: 2,
  [ChallengeRanks.Epic]: 1,
};

export const challengeRanksEnum = z.enum(ChallengeRanks);

export const foo: z.output<typeof challengeRanksEnum> =
  ChallengeRanks.Troublesome;

export const MAX_TICKS = 40;

export const challengeRankSchema = z.preprocess(
  (val) => (typeof val === "string" ? val.toLowerCase() : val),
  z.enum(ChallengeRanks),
);

/** Schema for progress track files. */
export const baseProgressTrackerSchema = z.object({
  name: z.string(),
  rank: challengeRankSchema,
  progress: z.int().nonnegative().default(0),
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
        message: "Tags must contain exactly one of 'incomplete' or 'complete'",
      },
    ),
  "track-type": z.string(),
  character: z.string().nullish(),
});

export const progressTrackerSchema = z.union([
  normalizeKeys(z.looseObject(baseProgressTrackerSchema.shape)),
  normalizeKeys(
    z.looseObject({
      ...baseProgressTrackerSchema.omit({ rank: true }).shape,
      difficulty: baseProgressTrackerSchema.shape.rank,
    }),
  ).transform(({ difficulty, ...rest }) => ({ ...rest, rank: difficulty })),
]);

export type ProgressTrackerInputSchema = z.input<
  typeof baseProgressTrackerSchema
>;
export type ProgressTrackerSchema = z.output<typeof progressTrackerSchema>;

/** Validation for progress track domain model object. */
export const progressTrackSchema = z
  .object({
    rank: challengeRankSchema,
    progress: z.number().int().nonnegative(),
    complete: z.boolean(),
    unbounded: z.boolean(),
  })
  .refine(({ unbounded, progress }) => unbounded || progress <= MAX_TICKS, {
    message: "bounded progress track should have no more than 40 ticks",
  });

export type ProgressTrackSchema = z.output<typeof progressTrackSchema>;

// TODO: need to handle progress rolls on unbounded track
export class ProgressTrack {
  /**
   * Challenge rank for this track
   */
  readonly rank: ChallengeRanks;

  /**
   * Current progress (in ticks)
   */
  readonly progress: number;

  /**
   * Whether this track is complete
   */
  readonly complete: boolean;

  /**
   * If false, track will be capped at 40 ticks. Otherwise, like a legacy track, it is unbounded.
   */
  readonly unbounded: boolean;

  static create(
    data: z.input<typeof progressTrackSchema>,
  ): Result<ProgressTrack, ZodError>;
  static create(data: unknown): Result<ProgressTrack, ZodError>;
  static create(data: unknown): Result<ProgressTrack, ZodError> {
    const result = progressTrackSchema.safeParse(data);
    if (result.success) {
      return Result.ok(new this(result.data));
    } else {
      return Result.err(result.error);
    }
  }

  static create_(data: z.input<typeof progressTrackSchema>): ProgressTrack {
    return this.create(data).unwrapOrElse((e) => {
      throw new Error("unexpected error value", { cause: e });
    });
  }

  private constructor(data: ProgressTrackSchema) {
    this.rank = data.rank;
    this.progress = data.progress;
    this.complete = data.complete;
    this.unbounded = data.unbounded;
  }

  get ticksPerStep(): number {
    return CHALLENGE_STEPS[this.rank];
  }

  get boxesFilled(): number {
    return Math.floor(this.progress / 4);
  }

  boxesAndTicks(): [number, number] {
    return [this.boxesFilled, this.progress - this.boxesFilled * 4];
  }

  /** Number of boxes filled to count for progress rolls.
   *
   * For unbounded (legacy) tracks, caps at 10 boxes. */
  get progressRollBoxesFilled(): number {
    return Math.min(10, this.boxesFilled);
  }

  get ticksRemaining(): number {
    return MAX_TICKS - this.progress;
  }

  get stepsRemaining(): number {
    return Math.ceil(this.ticksRemaining / this.ticksPerStep);
  }

  /** Set the meter directly to a specific number of ticks, ensuring legal range for this meter. */
  withTicks(ticks: number): ProgressTrack {
    const newProgress = Math.max(
      0,
      Math.min(this.unbounded ? Number.MAX_SAFE_INTEGER : MAX_TICKS, ticks),
    );
    if (this.complete || newProgress === this.progress) return this;
    return new ProgressTrack({ ...this, progress: newProgress });
  }

  /** Replaces the rank for this track. Note that it does not alter the progress. */
  withRank(rank: ChallengeRanks): ProgressTrack {
    if (this.rank === rank) return this;
    return new ProgressTrack({
      ...this,
      rank,
    });
  }

  /** Advance the meter by `steps`, ensuring legal range for this meter. */
  advanced(steps: number): ProgressTrack {
    return this.advancedByTicks(steps * this.ticksPerStep);
  }

  /** Advance the meter by `ticks`, ensuring legal range for this meter. */
  advancedByTicks(ticks: number): ProgressTrack {
    return this.withTicks(this.progress + ticks);
  }

  completed(): ProgressTrack {
    if (this.complete) return this;
    return new ProgressTrack({ ...this, complete: true });
  }

  markIncomplete(): ProgressTrack {
    if (!this.complete) return this;
    return new ProgressTrack({ ...this, complete: false });
  }

  equals(other: ProgressTrack): boolean {
    if (this === other) return true;
    return (
      this.progress === other.progress &&
      this.complete === other.complete &&
      this.rank === other.rank &&
      this.unbounded === other.unbounded
    );
  }
}

export function legacyTrackXpEarned(track: ProgressTrack) {
  const baseBoxes = Math.min(10, track.boxesFilled);
  const addlBoxes = track.boxesFilled - baseBoxes;

  return baseBoxes * 2 + addlBoxes;
}

export interface ProgressTrackInfo {
  readonly name: string;
  readonly track: ProgressTrack;
  readonly trackType: string;
}

export class ProgressTrackFileAdapter implements ProgressTrackInfo {
  private constructor(
    public readonly raw: Readonly<ProgressTrackerSchema>,
    public readonly track: Readonly<ProgressTrack>,
  ) {}

  get name(): string {
    return this.raw.name;
  }

  get trackType(): string {
    return this.raw["track-type"];
  }

  get character(): string | null {
    return this.raw.character ?? null;
  }

  static newFromTrack({
    name,
    trackType,
    track,
    character,
  }: {
    name: string;
    trackType: string;
    track: ProgressTrack;
    character?: string | null;
  }): ProgressTrackFileAdapter {
    return this.mustCreate({
      name,
      rank: track.rank,
      progress: track.progress,
      tags: track.complete ? ["complete"] : ["incomplete"],
      "track-type": trackType,
      [PLUGIN_KIND_FIELD]: IronVaultKind.ProgressTrack,
      character,
    } satisfies z.input<typeof baseProgressTrackerSchema> & {
      [PLUGIN_KIND_FIELD]: IronVaultKind.ProgressTrack;
    });
  }

  static create(data: unknown): Result<ProgressTrackFileAdapter, ZodError> {
    const result = progressTrackerSchema.safeParse(data);
    if (result.success) {
      const raw = result.data;
      return ProgressTrack.create({
        rank: raw.rank,
        progress: raw.progress,
        complete: raw.tags.includes("complete"),
        unbounded: false,
      }).map((track) => new this(raw, track));
    } else {
      return Result.err(result.error);
    }
  }

  static mustCreate(
    data: z.input<typeof progressTrackerSchema>,
  ): ProgressTrackFileAdapter {
    return this.create(data).unwrapOrElse((e) => {
      throw new Error("unexpected error value", { cause: e });
    });
  }

  updatingTrack(
    update: (track: ProgressTrack) => ProgressTrack,
  ): ProgressTrackFileAdapter {
    return this.withTrack(update(this.track));
  }

  withName(name: string): ProgressTrackFileAdapter {
    if (this.name === name) return this;
    return new ProgressTrackFileAdapter(
      produce(this.raw, (data) => {
        data.name = name;
      }),
      this.track,
    );
  }

  withTrackType(trackType: string): ProgressTrackFileAdapter {
    if (this.trackType === trackType) return this;
    return new ProgressTrackFileAdapter(
      produce(this.raw, (data) => {
        data["track-type"] = trackType;
      }),
      this.track,
    );
  }

  withRank(rank: ChallengeRanks): ProgressTrackFileAdapter {
    return this.updatingTrack((track) => track.withRank(rank));
  }

  withTrack(other: ProgressTrack): ProgressTrackFileAdapter {
    if (this.track == other || this.track.equals(other)) return this;
    return new ProgressTrackFileAdapter(
      produce(this.raw, (data) => {
        data.progress = other.progress;
        data.rank = other.rank;
        const [tagToRemove, tagToAdd] = other.complete
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
