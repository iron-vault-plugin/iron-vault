import { node } from "utils/kdl";
import { getMoveIdFromNode, getTerminalMoveNode } from "./utils";

describe("getMoveIdFromNode", () => {
  it("finds nothing in non-move nodes", () => {
    expect(
      getMoveIdFromNode(
        node("mooooove", {
          properties: { id: "move:starforged/suffer/endure_harm" },
        }),
      ),
    ).toBeUndefined();
  });

  it("prioritizes 'id' property in a move", () => {
    expect(
      getMoveIdFromNode(
        node("move", {
          values: ["[Endure Stress](move:starforged/suffer/endure_stress)"],
          properties: { id: "move:starforged/suffer/endure_harm" },
        }),
      ),
    ).toBe("move:starforged/suffer/endure_harm");
  });

  it("parses ID from move name link", () => {
    expect(
      getMoveIdFromNode(
        node("move", {
          values: ["[Endure Stress](move:starforged/suffer/endure_stress)"],
        }),
      ),
    ).toBe("move:starforged/suffer/endure_stress");
  });
});

const endureHarmMove = () =>
  node("move", {
    values: ["[Endure Harm](move:starforged/suffer/endure_harm)"],
  });
const endureStressMove = () =>
  node("move", {
    values: ["[Endure Stress](move:starforged/suffer/endure_stress)"],
  });

describe("getTerminalMoveNode", () => {
  it("returns the final move", () => {
    expect(getTerminalMoveNode([endureHarmMove(), endureStressMove()])).toEqual(
      endureStressMove(),
    );
  });

  it("is undefined if something else is in last position", () => {
    expect(
      getTerminalMoveNode([endureHarmMove(), node("roll")]),
    ).toBeUndefined();
  });
});
