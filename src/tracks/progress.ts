import { Immutable } from "immer";
import { CachedMetadata } from "obsidian";
import { z } from "zod";
import { BaseIndexer } from "../indexer/indexer";

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

const MAX_TICKS = 40;

const challengeRankSchema = z.nativeEnum(ChallengeRanks);

const progressTrackerSchema = z.object({
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
        message: "Tags must contain exactly one of 'incomplete' or 'complete'",
      },
    ),
  TrackImage: z.string(),
  tracktype: z.string(),
});

const validatingProgressTrackerSchema = (
  trackImageGen: (progress: number) => string,
) => {
  return progressTrackerSchema
    .partial({ TrackImage: true })
    .transform((val, ctx) => {
      const desiredTrackImage = trackImageGen(val.Progress);
      return { ...val, TrackImage: desiredTrackImage };
    });
};

export type ProgressTrackerInputSchema = z.input<typeof progressTrackerSchema>;
export type ProgressTrackerSchema = z.infer<typeof progressTrackerSchema>;

function classFromProps<T>() {
  return class {
    constructor(props: T) {
      Object.assign(this, props);
    }
  } as { new (args: T): T };
}

export class ProgressTracker extends classFromProps<
  Immutable<ProgressTrackerSchema>
>() {
  static fromData(data: unknown): ProgressTracker {
    return new this(progressTrackerSchema.parse(data));
  }

  static fromDataWithRepair(data: unknown): ProgressTracker {
    return new this(
      validatingProgressTrackerSchema(
        (progress) => `[[progress-track-${progress}.svg]]`,
      ).parse(data),
    );
  }

  get complete(): boolean {
    return this.tags.includes("complete");
  }

  get incomplete(): boolean {
    return this.tags.includes("incomplete");
  }

  get ticksPerStep(): number {
    return CHALLENGE_STEPS[this.Difficulty];
  }

  get boxesFilled(): number {
    return Math.floor(this.Progress / 4);
  }

  get ticksRemaining(): number {
    return MAX_TICKS - this.Progress;
  }

  get stepsRemaining(): number {
    return Math.ceil(this.ticksRemaining / this.ticksPerStep);
  }

  advanced(steps: number): ProgressTracker {
    return this.advancedByTicks(steps * this.ticksPerStep);
  }

  advancedByTicks(ticks: number): ProgressTracker {
    const Progress = Math.min(MAX_TICKS, this.Progress + ticks);
    if (Progress == this.Progress) {
      return this;
    }
    return new ProgressTracker({
      ...this,
      Progress,
      TrackImage: `[[progress-track-${Progress}.svg]]`,
    });
  }
}

export class ProgressIndexer extends BaseIndexer<ProgressTracker> {
  readonly id: string = "progress";

  processFile(
    path: string,
    cache: CachedMetadata,
  ): ProgressTracker | undefined {
    return ProgressTracker.fromDataWithRepair(cache.frontmatter);
  }
}

export type ProgressIndex = Map<string, ProgressTracker>;
