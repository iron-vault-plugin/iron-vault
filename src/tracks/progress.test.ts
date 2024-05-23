import { ZodError } from "zod";
import { Either, Left } from "../utils/either";
import {
  CHALLENGE_STEPS,
  ChallengeRanks,
  ProgressTrack,
  ProgressTrackFileAdapter,
  ProgressTrackSchema,
  ProgressTrackerInputSchema,
  legacyTrackXpEarned,
} from "./progress";

describe("ProgressTrack", () => {
  const TEST_DATA: ProgressTrackSchema = {
    rank: ChallengeRanks.Dangerous,
    progress: 10,
    complete: false,
    unbounded: false,
  };

  function make(overrides: Partial<ProgressTrackSchema> = {}): ProgressTrack {
    return ProgressTrack.create({ ...TEST_DATA, ...overrides }).unwrap();
  }

  it("parses a valid progress tracker", () => {
    const result = ProgressTrack.create(TEST_DATA);
    expect(result.isRight()).toBeTruthy();
    const track = result.unwrap();
    expect(track).toMatchObject<ProgressTrackSchema>({
      rank: ChallengeRanks.Dangerous,
      progress: 10,
      complete: false,
      unbounded: false,
    });
  });

  it("interprets the rank case insensitively", () => {
    const result = ProgressTrack.create({
      ...TEST_DATA,
      rank: "DANGERous",
    });
    expect(result.isRight()).toBeTruthy();
    const track = result.unwrap();
    expect(track).toMatchObject<ProgressTrackSchema>({
      rank: ChallengeRanks.Dangerous,
      progress: 10,
      complete: false,
      unbounded: false,
    });
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
    const start = make({ rank: rank });
    const startingProgress = start.progress;
    expect(start.advanced(steps).progress).toBe(
      startingProgress + CHALLENGE_STEPS[rank] * steps,
    );
    expect(start.progress).toBe(startingProgress);
  });

  it("won't advance a completed track", () => {
    const track = make({ complete: true, progress: 10 });
    expect(track.advancedByTicks(10)).toBe(track);
  });

  it("won't advance negatively below 0 ticks", () => {
    expect(make({ progress: 1 }).advancedByTicks(-2).progress).toBe(0);
  });

  it("won't advance past 40 ticks", () => {
    expect(make({ progress: 39 }).advancedByTicks(2).progress).toBe(40);
  });

  it("returns the same object if track not advanced", () => {
    const track = make({ progress: 40 });
    expect(track.advancedByTicks(1)).toBe(track);
  });

  it("calculates ticks per step", () => {
    expect(make().ticksPerStep).toBe(8);
  });

  it.each([
    { ticks: 7, boxes: 1 },
    { ticks: 0, boxes: 0 },
    { ticks: 12, boxes: 3 },
  ])(
    "#boxesFilled calculates $ticks ticks is $boxes boxes",
    ({ ticks, boxes }) => {
      expect(make({ progress: ticks }).boxesFilled).toBe(boxes);
    },
  );

  it.each([
    { ticks: 0, steps: 5, rank: ChallengeRanks.Dangerous },
    { ticks: 2, steps: 5, rank: ChallengeRanks.Dangerous },
    { ticks: 8, steps: 4, rank: ChallengeRanks.Dangerous },
    { ticks: 0, steps: 4, rank: ChallengeRanks.Troublesome },
  ])(
    "#stepsRemaining calculates $steps steps from $ticks ticks for $rank",
    ({ ticks, steps, rank }) => {
      expect(make({ progress: ticks, rank: rank }).stepsRemaining).toBe(steps);
    },
  );
});

describe("ProgressTrackFileAdapter", () => {
  const TEST_DATA = {
    Name: "Test",
    rank: "Dangerous",
    Progress: 10,
    tags: "incomplete",
    TrackImage: "[[progress-track-10.svg]]",
    tracktype: "Vow",
  };

  function make(
    overrides: Omit<Partial<ProgressTrackerInputSchema>, "rank"> & {
      rank?: ChallengeRanks | string;
    } = {},
  ): Either<ZodError, ProgressTrackFileAdapter> {
    return ProgressTrackFileAdapter.create(
      {
        ...TEST_DATA,
        ...overrides,
      },
      {
        generateTrackImage: (track) =>
          `[[progress-track-${track.progress}.svg]]`,
      },
    );
  }

  function make_(
    overrides: Omit<Partial<ProgressTrackerInputSchema>, "rank"> & {
      Rank?: ChallengeRanks | string;
    } = {},
  ): ProgressTrackFileAdapter {
    return make(overrides).unwrap();
  }

  it("#track extracts the progress track data", () => {
    expect(make_().track).toEqual(
      ProgressTrack.create_({
        rank: ChallengeRanks.Dangerous,
        progress: 10,
        complete: false,
        unbounded: false,
      }),
    );
  });

  it("parses a track with Difficulty instead of rank", () => {
    expect(
      make_({ rank: undefined, Difficulty: ChallengeRanks.Troublesome }).track
        .rank,
    ).toEqual(ChallengeRanks.Troublesome);
  });

  it("requires a completion tag", () => {
    expect(make({ tags: ["missing_completion"] })).toEqual(
      Left.create(
        new ZodError([
          {
            code: "custom",
            message:
              "Tags must contain exactly one of 'incomplete' or 'complete'",
            path: ["tags"],
          },
        ]),
      ),
    );
  });

  it("rejects record with both 'complete' and 'incomplete'", () => {
    expect(make({ tags: ["complete", "incomplete"] })).toEqual(
      Left.create(
        new ZodError([
          {
            code: "custom",
            message:
              "Tags must contain exactly one of 'incomplete' or 'complete'",
            path: ["tags"],
          },
        ]),
      ),
    );
  });

  it.each([
    ["complete", true],
    ["incomplete", false],
  ])("interprets '%s' tag correctly", (tag, result) => {
    expect(make_({ tags: ["asd", tag, "foo"] }).track).toHaveProperty(
      "complete",
      result,
    );
  });

  describe("#updatingTrack", () => {
    it("returns this if track is unchanged", () => {
      const obj = make_();
      expect(obj.updatingTrack((track) => track)).toBe(obj);
    });

    it("returns this if track is equal (but not same object)", () => {
      const obj = make_();
      expect(obj.updatingTrack((_) => make_().track)).toBe(obj);
    });

    it("updates progress", () => {
      const original = make_();
      const updated = original.updatingTrack((track) =>
        track.advancedByTicks(10),
      );
      expect(updated.raw.progress).toBe(original.raw.progress + 10);
    });

    it("updates the track image", () => {
      const original = make_();
      const updated = original.updatingTrack((track) =>
        track.advancedByTicks(10),
      );
      expect(updated.raw.trackimage).toBe(
        `[[progress-track-${original.raw.progress + 10}.svg]]`,
      );
    });

    it("updates completeness", () => {
      expect(
        make_({ tags: ["asd", "incomplete", "bsd"] }).updatingTrack((track) =>
          track.completed(),
        ).raw.tags,
      ).toEqual(["asd", "complete", "bsd"]);
    });

    it("preserves other fields", () => {
      expect(
        make_({ foo: "bar", baz: { bop: 1 } }).updatingTrack((track) =>
          track.advanced(1),
        ).raw,
      ).toMatchObject({ progress: 18, foo: "bar", baz: { bop: 1 } });
    });
  });
});

describe("legacyTrackXpEarned", () => {
  it.each([
    [0, 0],
    [4, 8],
    [12, 22],
  ])("calculates %d boxes is %d xp", (boxes, xpEarned) => {
    expect(
      legacyTrackXpEarned(
        ProgressTrack.create_({
          rank: ChallengeRanks.Epic,
          progress: boxes * 4,
          complete: false,
          unbounded: true,
        }),
      ),
    ).toEqual(xpEarned);
  });
});
