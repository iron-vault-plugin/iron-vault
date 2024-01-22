import { produce } from "immer";
import { CachedMetadata } from "obsidian";
import { ZodError, z } from "zod";
import { BaseIndexer } from "../indexer/indexer";
import { Either, Left, Right } from "../utils/either";
import { updater } from "../utils/update";

export enum ChallengeRanks {
  /** 12 ticks per step */
  Troublesome = "Troublesome",

  /** 8 ticks per step */
  Dangerous = "Dangerous",

  /** 4 ticks per step */
  Formidable = "Formidable",

  /** 2 ticks per step */
  Extreme = "Extreme",

  /** 1 tick per step */
  Epic = "Epic",
}

export const CHALLENGE_STEPS: Record<ChallengeRanks, number> = {
  Troublesome: 12,
  Dangerous: 8,
  Formidable: 4,
  Extreme: 2,
  Epic: 1,
};

export const MAX_TICKS = 40;

export const challengeRankSchema = z.nativeEnum(ChallengeRanks);

export const progressTrackerSchema = z
  .object({
    Name: z.string(),
    Difficulty: challengeRankSchema,
    Progress: z.number().int().nonnegative().default(0),
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
    TrackImage: z.string(),
    tracktype: z.string(),
  })
  .passthrough();

export type ProgressTrackerInputSchema = z.input<typeof progressTrackerSchema>;
export type ProgressTrackerSchema = z.infer<typeof progressTrackerSchema>;

export const progressTrackSchema = z
  .object({
    difficulty: challengeRankSchema,
    progress: z.number().int().nonnegative(),
    complete: z.boolean(),
    unbounded: z.boolean(),
  })
  .refine(({ unbounded, progress }) => unbounded || progress <= MAX_TICKS, {
    message: "bounded progress track should have no more than 40 ticks",
  });

export type ProgressTrackSchema = z.output<typeof progressTrackSchema>;

export class ProgressTrack {
  /**
   * Challenge rank for this track
   */
  readonly difficulty: ChallengeRanks;

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
  ): Either<ZodError, ProgressTrack>;
  static create(data: unknown): Either<ZodError, ProgressTrack>;
  static create(data: unknown): Either<ZodError, ProgressTrack> {
    const result = progressTrackSchema.safeParse(data);
    if (result.success) {
      return Right.create(new this(result.data));
    } else {
      return Left.create(result.error);
    }
  }

  static create_(data: z.input<typeof progressTrackSchema>): ProgressTrack {
    return this.create(data).expect("unexpected error value");
  }

  private constructor(data: ProgressTrackSchema) {
    this.difficulty = data.difficulty;
    this.progress = data.progress;
    this.complete = data.complete;
    this.unbounded = data.unbounded;
  }

  get ticksPerStep(): number {
    return CHALLENGE_STEPS[this.difficulty];
  }

  get boxesFilled(): number {
    return Math.floor(this.progress / 4);
  }

  get ticksRemaining(): number {
    return MAX_TICKS - this.progress;
  }

  get stepsRemaining(): number {
    return Math.ceil(this.ticksRemaining / this.ticksPerStep);
  }

  advanced(steps: number): ProgressTrack {
    return this.advancedByTicks(steps * this.ticksPerStep);
  }

  advancedByTicks(ticks: number): ProgressTrack {
    const newProgress = Math.min(
      this.unbounded ? Number.MAX_SAFE_INTEGER : MAX_TICKS,
      this.progress + ticks,
    );
    if (this.complete || newProgress === this.progress) return this;
    return new ProgressTrack({ ...this, progress: newProgress });
  }

  completed(): ProgressTrack {
    if (this.complete) return this;
    return new ProgressTrack({ ...this, complete: true });
  }

  equals(other: ProgressTrack): boolean {
    if (this === other) return true;
    return (
      this.progress === other.progress &&
      this.complete === other.complete &&
      this.difficulty === other.difficulty &&
      this.unbounded === other.unbounded
    );
  }
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
    protected readonly settings: ProgressTrackSettings,
  ) {}

  get name(): string {
    return this.raw.Name;
  }

  get trackType(): string {
    return this.raw.tracktype;
  }

  static newFromTrack(
    {
      name,
      tracktype,
      track,
    }: { name: string; tracktype: string; track: ProgressTrack },
    settings: ProgressTrackSettings,
  ): Either<ZodError, ProgressTrackFileAdapter> {
    return this.create(
      {
        Name: name,
        Difficulty: track.difficulty,
        Progress: track.progress,
        tags: track.complete ? ["complete"] : ["incomplete"],
        TrackImage: settings.generateTrackImage(track),
        tracktype,
        forgedkind: "progress",
      } as ProgressTrackerInputSchema,
      settings,
    );
  }

  static create(
    data: unknown,
    settings: ProgressTrackSettings,
  ): Either<ZodError, ProgressTrackFileAdapter> {
    const result = progressTrackerSchema.safeParse(data);
    if (result.success) {
      const raw = result.data;
      return ProgressTrack.create({
        difficulty: raw.Difficulty,
        progress: raw.Progress,
        complete: raw.tags.includes("complete"),
        unbounded: false,
      }).map((track) => new this(raw, track, settings));
    } else {
      return Left.create(result.error);
    }
  }

  updatingTrack(
    update: (track: ProgressTrack) => ProgressTrack,
  ): ProgressTrackFileAdapter {
    return this.withTrack(update(this.track));
  }

  withTrack(other: ProgressTrack): ProgressTrackFileAdapter {
    if (this.track == other || this.track.equals(other)) return this;
    return new ProgressTrackFileAdapter(
      produce(this.raw, (data) => {
        data.Progress = other.progress;
        data.TrackImage = this.settings.generateTrackImage(other);
        data.Difficulty = other.difficulty;
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
      this.settings,
    );
  }
}

export interface ProgressTrackSettings {
  generateTrackImage: (track: ProgressTrack) => string;
}

export class ProgressIndexer extends BaseIndexer<ProgressTrackFileAdapter> {
  readonly id: string = "progress";

  constructor(
    index: ProgressIndex,
    protected readonly settings: ProgressTrackSettings,
  ) {
    super(index);
  }

  processFile(
    path: string,
    cache: CachedMetadata,
  ): ProgressTrackFileAdapter | undefined {
    // TODO: we should use our Either support now to handle this
    // TODO: customize track image gen
    return ProgressTrackFileAdapter.create(
      cache.frontmatter,
      this.settings,
    ).unwrap();
  }
}

// TODO: feels like this could be merged into some class that provides the same config to
//       ProgressIndexer
export const progressTrackUpdater = (settings: ProgressTrackSettings) =>
  updater<ProgressTrackFileAdapter>(
    (data) =>
      ProgressTrackFileAdapter.create(data, settings).expect("could not parse"),
    (tracker) => tracker.raw,
  );

export type ProgressIndex = Map<string, ProgressTrackFileAdapter>;
