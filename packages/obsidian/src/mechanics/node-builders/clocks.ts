import { Clock } from "clocks/clock";
import { ClockFileAdapter } from "clocks/clock-file";
import * as kdl from "utils/kdl";
import { node } from "utils/kdl";

export function createClockCreationNode(
  clockName: string,
  clockPath: string,
): kdl.Node {
  return node("clock", {
    properties: {
      name: `[[${clockPath}|${clockName}]]`,
      status: "added",
    },
  });
}

export function clockResolvedNode(
  clockName: string,
  clockPath: string,
): kdl.Node {
  return node("clock", {
    properties: {
      name: `[[${clockPath}|${clockName}]]`,
      status: "resolved",
    },
  });
}

export function createClockNode(
  clockName: string,
  clockPath: string,
  sourceClock: ClockFileAdapter,
  endValue: Clock,
): kdl.Node {
  return node("clock", {
    properties: {
      name: `[[${clockPath}|${clockName}]]`,
      from: sourceClock.clock.progress,
      to: endValue.progress,
      "out-of": endValue.segments,
    },
  });
}
