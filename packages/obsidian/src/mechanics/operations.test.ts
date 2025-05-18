import * as kdl from "kdljs";
import { node } from "utils/kdl";
import { createActorNode as actorNode } from "./actor";
import {
  appendNodes,
  appendNodesToMoveOrTopLevel,
  transformAsKdl,
  usingActor,
} from "./operations";

describe("transformAsKdl", () => {
  it("handles an empty document", () => {
    expect(
      transformAsKdl((doc) => [node("test", { values: [doc.length] })])(""),
    ).toBe(kdl.format([node("test", { values: [0] })]));
  });
});

describe("appendNodesToMoveOrTopLevel", () => {
  it("adds nodes to move in final position", () => {
    expect(
      appendNodesToMoveOrTopLevel(node("test"))([node("first"), node("move")]),
    ).toEqual([node("first"), node("move", { children: [node("test")] })]);
  });

  it("adds nodes to end if move not in final position", () => {
    expect(
      appendNodesToMoveOrTopLevel(node("test"))([node("move"), node("first")]),
    ).toEqual([node("move"), node("first"), node("test")]);
  });

  it("adds nodes to end if document is empty", () => {
    expect(appendNodesToMoveOrTopLevel(node("test"))([])).toEqual([
      node("test"),
    ]);
  });
});

describe("usingActor", () => {
  it("is a no-op when actor is undefined", () => {
    const transform = (doc: kdl.Document) => doc;
    expect(usingActor(undefined, transform)).toBe(transform);
  });
  describe("when previous entry has no actor", () => {
    it("creates a new actor element", () => {
      const origDoc = [actorNode({ name: "Ash Barlowe" }, []), node("break")];
      expect(
        usingActor(
          { name: "Ash Barlowe" },
          appendNodes([node("test")]),
        )(origDoc),
      ).toEqual([
        ...origDoc,
        actorNode({ name: "Ash Barlowe" }, [node("test")]),
      ]);
    });
  });
  describe("when previous entry is non-matching actor", () => {
    it("creates new actor element", () => {
      const origDoc = [
        actorNode({ name: "Ash Barlowe" }, []),
        actorNode({ name: "Other guy" }, []),
      ];
      expect(
        usingActor(
          { name: "Ash Barlowe" },
          appendNodes([node("test")]),
        )(origDoc),
      ).toEqual([
        ...origDoc,
        actorNode({ name: "Ash Barlowe" }, [node("test")]),
      ]);
    });

    it("works as expected with appendNodesToMoveOrTopLevel", () => {
      const origDoc = [
        actorNode({ name: "Ash Barlowe" }, []),
        actorNode({ name: "Other guy" }, [
          node("move", { children: [node("node1")] }),
        ]),
      ];
      expect(
        usingActor(
          { name: "Ash Barlowe" },
          appendNodesToMoveOrTopLevel(node("node2")),
        )(origDoc),
      ).toEqual([
        ...origDoc,
        actorNode({ name: "Ash Barlowe" }, [node("node2")]),
      ]);
    });
  });

  describe("when previous entry is matching actor", () => {
    it("applies transform to actor node's children", () => {
      const origDoc = [
        actorNode({ name: "Other guy" }, []),
        actorNode({ name: "Ash Barlowe" }, [node("node1")]),
      ];
      expect(
        usingActor(
          { name: "Ash Barlowe" },
          appendNodes([node("node2")]),
        )(origDoc),
      ).toEqual([
        actorNode({ name: "Other guy" }, []),
        actorNode({ name: "Ash Barlowe" }, [node("node1"), node("node2")]),
      ]);
    });

    it("works as expected with appendNodesToMoveOrTopLevel", () => {
      const origDoc = [
        actorNode({ name: "Other guy" }, []),
        actorNode({ name: "Ash Barlowe" }, [
          node("move", { children: [node("node1")] }),
        ]),
      ];
      expect(
        usingActor(
          { name: "Ash Barlowe" },
          appendNodesToMoveOrTopLevel(node("node2")),
        )(origDoc),
      ).toEqual([
        actorNode({ name: "Other guy" }, []),
        actorNode({ name: "Ash Barlowe" }, [
          node("move", { children: [node("node1"), node("node2")] }),
        ]),
      ]);
    });
  });
});
