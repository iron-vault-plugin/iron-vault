import { describe, expect, it } from "vitest";
import { breadthFirstTraversal } from "./traversal";

type File = { path: string };
type Folder = { path: string; children: Node[] };
type Node = File | Folder;

function leaf(node: Node): File | undefined {
  return "children" in node ? undefined : node;
}

function children(node: Node): Node[] {
  return "children" in node ? node.children : [];
}

function File(path: string): File {
  return { path };
}

describe("breadthFirstTraversal", () => {
  it("returns a file if passed the file", () => {
    expect(breadthFirstTraversal({ path: "a.txt" }, leaf, children)).toEqual([
      { path: "a.txt" },
    ]);
  });

  it("returns an empty set if no leaves", () => {
    expect(
      breadthFirstTraversal(
        { path: "a", children: [{ path: "b", children: [] }] },
        leaf,
        children,
      ),
    ).toHaveLength(0);
  });

  it("returns all children", () => {
    const child1 = File("c.txt"),
      child2 = File("d.txt"),
      child3 = File("e.txt");
    expect(
      breadthFirstTraversal(
        {
          path: "a",
          children: [
            { path: "b", children: [child1] },
            { path: "f", children: [child2, child3] },
          ],
        },
        leaf,
        children,
      ),
    ).toEqual([child1, child2, child3]);
  });
});
