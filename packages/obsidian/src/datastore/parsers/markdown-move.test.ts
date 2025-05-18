import { DataswornSource } from "@datasworn/core";
import { unwrap } from "true-myth/test-support";
import { describe, expect, it } from "vitest";
import { markdownMoveToDatasworn } from "./markdown-move";

describe("markdownMoveToDatasworn", () => {
  it("parses a valid move with frontmatter, name, requirement, and abilities", () => {
    const text = `
__When you make a move to xyz__, abc.

- blah blah, roll +wits

On a __strong hit__, do this.
On a __weak hit__, do that. Also do this.
On a __miss__, do the other thing.`.trim();
    const md = `---
foo: bar
---
# Move Name

${text}
`;
    const result = markdownMoveToDatasworn(md);
    expect(unwrap(result)).toEqual({
      type: "move",
      name: "Move Name",
      roll_type: "action_roll",
      trigger: {
        text: "When you make a move to xyz...",
        conditions: [
          {
            method: "player_choice",
            roll_options: [{ stat: "wits", using: "stat" }],
          },
        ],
      },
      outcomes: {
        strong_hit: {
          text: "On a __strong hit__, do this.",
        },
        weak_hit: {
          text: "On a __weak hit__, do that. Also do this.",
        },
        miss: {
          text: "On a __miss__, do the other thing.",
        },
      },
      text,
    } satisfies Omit<DataswornSource.MoveActionRoll, "_source">);
  });
});
