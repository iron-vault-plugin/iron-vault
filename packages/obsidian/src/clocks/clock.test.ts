import { describe, expect, it } from "vitest";
import { Clock, ClockInput } from "./clock";

const DEFAULT_CLOCK_INPUT = {
  name: "Doom",
  progress: 0,
  segments: 6,
  active: true,
};

function make_clock(input: Partial<ClockInput> = {}) {
  return Clock.create({ ...DEFAULT_CLOCK_INPUT, ...input });
}

describe("Clock", () => {
  describe("create", () => {
    it("accepts clocks with 0 progress", () => {
      expect(
        Clock.create({
          name: "blah",
          active: true,
          progress: 0,
          segments: 6,
        }).unwrap(),
      ).toEqual({
        name: "blah",
        progress: 0,
        segments: 6,
        active: true,
      });
    });
  });

  describe("withProgress", () => {
    it("returns a new clock with updated progress", () => {
      const clock = make_clock({ progress: 1 }).unwrap();
      const newClock = clock.withProgress(2);
      expect(clock.progress).toBe(1);
      expect(newClock.progress).toBe(2);
    });
    it("constrains progress to be >= 0", () => {
      expect(make_clock().unwrap().withProgress(-1).progress).toBe(0);
    });

    it("constrains progress to be < segments", () => {
      expect(
        make_clock({ segments: 6 }).unwrap().withProgress(7).progress,
      ).toBe(6);
    });
  });

  describe("tick", () => {
    it("returns a new clock with updated progress", () => {
      const clock = make_clock({ progress: 1 }).unwrap();
      const newClock = clock.tick(2);
      expect(clock.progress).toBe(1);
      expect(newClock.progress).toBe(3);
    });
  });
});
