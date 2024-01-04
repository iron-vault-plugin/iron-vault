import { CachedMetadata } from "obsidian";
import { z } from "zod";
import { BaseIndexer } from "../indexer/indexer";

export enum ChallengeRanks {
  Troublesome = "Troublesome",
  Dangerous = "Dangerous",
  Formidable = "Formidable",
  Extreme = "Extreme",
  Epic = "Epic",
}

const CHALLENGE_STEPS: Record<ChallengeRanks, number> = {
  Troublesome: 12,
  Dangerous: 8,
  Formidable: 4,
  Extreme: 2,
  Epic: 1,
} as const;

const MAX_TICKS = 40 as const;

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
});

export type ProgressTrackerInputSchema = z.input<typeof progressTrackerSchema>;
export type ProgressTrackerSchema = z.infer<typeof progressTrackerSchema>;

function classFromProps<T>() {
  return class {
    constructor(props: T) {
      Object.assign(this, props);
    }
  } as { new (args: T): T };
}

export class ProgressTracker extends classFromProps<ProgressTrackerSchema>() {
  static fromData(data: unknown): ProgressTracker {
    return new this(progressTrackerSchema.parse(data));
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

  advanced(steps: number): ProgressTracker {
    return this.advancedByTicks(steps * this.ticksPerStep);
  }

  advancedByTicks(ticks: number): ProgressTracker {
    const Progress = Math.min(MAX_TICKS, this.Progress + ticks);
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
    return ProgressTracker.fromData(cache.frontmatter);
  }
}
