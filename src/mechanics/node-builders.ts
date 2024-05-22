import * as kdl from "kdljs";
import { RollWrapper } from "model/rolls";
import { oracleNameWithParents } from "oracles/render";
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
      rank: trackContext.track.rank,
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

export function createOracleNode(roll: RollWrapper, prompt?: string): kdl.Node {
  return node("oracle", {
    properties: {
      name: `[${oracleNameWithParents(roll.oracle)}](oracle:${roll.oracle.id})`,
      // TODO: this is preposterous
      roll: roll.roll.roll,
      result: roll.ownResult,
    },
    children: [
      ...(prompt ? [node("-", { values: [prompt] })] : []),
      ...Object.values(roll.subrolls)
        .flatMap((subroll) => subroll.rolls)
        .map((subroll) => createOracleNode(subroll)),
    ],
  });
}
