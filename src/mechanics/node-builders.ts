import * as kdl from "kdljs";
import { Clock } from "tracks/clock";
import { ClockFileAdapter } from "tracks/clock-file";
import { ProgressTrackWriterContext } from "tracks/writer";
import { node } from "utils/kdl";

export function createProgressNode(
  trackContext: ProgressTrackWriterContext,
  steps: number,
): kdl.Node {
  return node("progress", {
    properties: {
      name: `[[${trackContext.location}|${trackContext.name}]]`,
      from: trackContext.track.progress,
      level: trackContext.track.difficulty,
      steps,
    },
  });
}

export function createClockNode(
  clockPath: string,
  sourceClock: ClockFileAdapter,
  endValue: Clock,
): kdl.Node {
  return node("clock", {
    properties: {
      name: `[[${clockPath}|${sourceClock.name}]]`,
      from: sourceClock.clock.progress,
      to: endValue.progress,
      "out-of": endValue.segments,
    },
  });
}
