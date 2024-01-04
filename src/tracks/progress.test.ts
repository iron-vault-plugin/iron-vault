import { ZodError } from "zod";
import { ChallengeRanks, ProgressTracker } from "./progress";

describe("ProgressTracker", () => {
  const TEST_DATA = {
    Name: "Test",
    Difficulty: "Dangerous",
    Progress: 10,
    tags: "incomplete",
    TrackImage: "[[progress-track-10.svg]]",
  };

  function make(overrides: object = {}): ProgressTracker {
    return ProgressTracker.fromData({ ...TEST_DATA, ...overrides });
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
});
