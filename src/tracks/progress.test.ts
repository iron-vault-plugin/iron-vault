import { ZodError } from "zod";
import {
  CHALLENGE_STEPS,
  ChallengeRanks,
  ProgressTracker,
  ProgressTrackerInputSchema,
} from "./progress";

describe("ProgressTracker", () => {
  const TEST_DATA = {
    Name: "Test",
    Difficulty: "Dangerous",
    Progress: 10,
    tags: "incomplete",
    TrackImage: "[[progress-track-10.svg]]",
  };

  function make(
    overrides: Omit<Partial<ProgressTrackerInputSchema>, "Difficulty"> & {
      Difficulty?: ChallengeRanks | string;
    } = {},
  ): ProgressTracker {
    return ProgressTracker.fromDataWithRepair({ ...TEST_DATA, ...overrides });
  }

  it("parses a valid progress tracker", () => {
    expect(make()).toEqual(
      new ProgressTracker({
        Name: "Test",
        Difficulty: ChallengeRanks.Dangerous,
        Progress: 10,
        tags: ["incomplete"],
        TrackImage: "[[progress-track-10.svg]]",
      }),
    );
  });

  it("requires a completion tag", () => {
    expect(() => make({ tags: ["missing_completion"] })).toThrow(
      new ZodError([
        {
          code: "custom",
          message:
            "Tags must contain exactly one of 'incomplete' or 'complete'",
          path: ["tags"],
        },
      ]),
    );
  });

  it("rejects record with both 'complete' and 'incomplete'", () => {
    expect(() => make({ tags: ["complete", "incomplete"] })).toThrow(
      new ZodError([
        {
          code: "custom",
          message:
            "Tags must contain exactly one of 'incomplete' or 'complete'",
          path: ["tags"],
        },
      ]),
    );
  });

  it("reports completion", () => {
    expect(make({ tags: "complete" })).toHaveProperty("complete", true);
    expect(make({ tags: "complete" })).toHaveProperty("incomplete", false);
  });

  it.each([
    {
      rank: ChallengeRanks.Dangerous,
      steps: 1,
    },
    {
      rank: ChallengeRanks.Dangerous,
      steps: 2,
    },
    { rank: ChallengeRanks.Extreme, steps: 1 },
    { rank: ChallengeRanks.Extreme, steps: 2 },
  ])("advances $rank track by $steps steps", ({ rank, steps }) => {
    const start = make({ Difficulty: rank });
    const startingProgress = start.Progress;
    expect(start.advanced(steps).Progress).toBe(
      startingProgress + CHALLENGE_STEPS[rank] * steps,
    );
    expect(start.Progress).toBe(startingProgress);
  });

  it("won't advance past 40 ticks", () => {
    expect(make({ Progress: 39 }).advancedByTicks(2).Progress).toBe(40);
  });

  it(".fromDataWithRepair corrects the TrackImage", () => {
    expect(make({ Progress: 25, TrackImage: "foo" }).TrackImage).toBe(
      "[[progress-track-25.svg]]",
    );
  });
});
