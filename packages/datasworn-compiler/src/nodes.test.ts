import { beforeEach, describe, expect, it } from "vitest";
import { collectNodes, DataGroup, NodeTree, reduceNodes } from "./nodes";

describe("reduceNodes", () => {
  // Create a simple data structure for testing
  type TestLeafData = { value: string };
  type TestGroupData = { name: string };

  let manager: NodeTree<TestLeafData, TestGroupData>;
  let root: DataGroup<TestLeafData, TestGroupData>;

  beforeEach(() => {
    manager = new NodeTree<TestLeafData, TestGroupData>(
      () => ({ name: "unknown" }),
      { name: "Root" },
    );
    root = manager.root;
    manager.addGroupNodeAtPath("group1", { name: "Group 1" });
    manager.addGroupNodeAtPath("group2", { name: "Group 2" });

    manager.addLeafNodeAtPath("group1/leaf1", { value: "Value 1" });
    manager.addLeafNodeAtPath("group1/leaf2", { value: "Value 2" });
    manager.addLeafNodeAtPath("group2/leaf3", { value: "Value 3" });
  });

  it("should reduce a tree with a simple reducer", () => {
    const result = reduceNodes(root, {
      reduceLeaf: (leaf) => leaf.data.value,
      reduceGroup: (group, { groups, leaves }) => ({
        name: group.data.name,
        children: [
          ...groups.map(([_, value]) => value),
          ...leaves.map(([_, value]) => value),
        ],
      }),
    });

    expect(result).toEqual({
      name: "Root",
      children: [
        {
          name: "Group 1",
          children: ["Value 1", "Value 2"],
        },
        {
          name: "Group 2",
          children: ["Value 3"],
        },
      ],
    });
  });

  it("should count nodes in a tree", () => {
    const result = reduceNodes(root, {
      reduceLeaf: () => 1,
      reduceGroup: (_, { children }) =>
        children.reduce((sum, [_, value]) => sum + (value as number), 0),
    });

    expect(result).toBe(3); // Three leaf nodes
  });

  it("should collect all leaf values", () => {
    const result = reduceNodes(root, {
      reduceLeaf: (leaf) => [leaf.data.value],
      reduceGroup: (_, { children }) => {
        return children.reduce((all, [__, value]) => {
          return [...all, ...(value as string[])];
        }, [] as string[]);
      },
    });

    expect(result).toEqual(["Value 1", "Value 2", "Value 3"]);
  });

  it("should handle empty groups", () => {
    // Create an empty group
    manager.addGroupNodeAtPath("empty", {
      name: "Empty Group",
    });

    type Result = {
      name: string;
      childCount: number;
      values: Array<string | Result>;
    };

    const result: Result = reduceNodes(root, {
      reduceLeaf: (leaf) => leaf.data.value,
      reduceGroup: (group, { children }) => ({
        name: group.data.name,
        childCount: children.length,
        values: children.map(([_, value]) => value),
      }),
    });

    expect(result.name).toBe("Root");
    expect(result.childCount).toBe(3); // group1, group2, and emptyGroup
    expect(result.values[2]).toEqual({
      name: "Empty Group",
      childCount: 0,
      values: [],
    });
  });

  it("should not throw on an empty tree", () => {
    manager = new NodeTree<TestLeafData, TestGroupData>(
      () => ({ name: "unknown" }),
      { name: "Empty Root" },
    );

    expect(() => {
      reduceNodes(manager.root, {
        reduceLeaf: () => "leaf",
        reduceGroup: () => "group",
      });
    }).not.toThrow();
  });
});
describe("collectNodes", () => {
  // Create a simple data structure for testing
  type TestLeafData = { value: string };
  type TestGroupData = { name: string };

  let manager: NodeTree<TestLeafData, TestGroupData>;
  let root: DataGroup<TestLeafData, TestGroupData>;

  beforeEach(() => {
    manager = new NodeTree<TestLeafData, TestGroupData>(
      () => ({ name: "unknown" }),
      { name: "Root" },
    );
    root = manager.root;
    manager.addGroupNodeAtPath("group1", { name: "Group 1" });
    manager.addGroupNodeAtPath("group2", { name: "Group 2" });

    manager.addLeafNodeAtPath("group1/leaf1", { value: "Value 1" });
    manager.addLeafNodeAtPath("group1/leaf2", { value: "Value 2" });
    manager.addLeafNodeAtPath("group2/leaf3", { value: "Value 3" });
  });

  it("should count nodes in a tree", () => {
    const result = collectNodes(root, {
      reduceLeaf: () => 1,
      reduceGroup: (_, { children }) =>
        children.reduce((sum, [__, value]) => sum + (value as number), 0),
    });

    expect(
      new Map([...result.entries()].map(([key, val]) => [key.path, val])),
    ).toEqual(
      new Map([
        ["", 3],
        ["group1", 2],
        ["group1/leaf1", 1],
        ["group1/leaf2", 1],
        ["group2", 1],
        ["group2/leaf3", 1],
      ]),
    );
  });
});
