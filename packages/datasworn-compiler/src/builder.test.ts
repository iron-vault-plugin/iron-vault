import { beforeEach, describe, expect, it } from "vitest";

import { DataswornSource } from "@datasworn/core";
import { ok } from "true-myth/result";

import { unwrapErr } from "true-myth/test-support";
import {
  CollectionAnnotations,
  CollectionLabel,
  CollectionTypes,
  Content,
  EntryTypes,
  labelCollections,
  NodeLabel,
} from "./builder";
import { DataGroup, DataNode, NodeTree } from "./nodes";

function datasworn(
  type: DataswornSource.OracleRollable["type"],
): DataswornSource.OracleRollableTable;
function datasworn(type: DataswornSource.Move["type"]): DataswornSource.Move;
function datasworn(type: DataswornSource.Asset["type"]): DataswornSource.Asset;
function datasworn(
  type: EntryTypes,
):
  | DataswornSource.OracleRollableTable
  | DataswornSource.Move
  | DataswornSource.Asset;
function datasworn(type: EntryTypes): unknown {
  return { type };
}

function contentNode(type: EntryTypes): Content["value"] {
  return { kind: "content", data: { success: true, result: datasworn(type) } };
}

describe("labelCollections", () => {
  let manager: NodeTree<Content["value"], CollectionAnnotations>;
  let root: DataGroup<Content["value"], CollectionAnnotations>;

  beforeEach(() => {
    manager = new NodeTree<Content["value"], CollectionAnnotations>(
      () => ({ collectionType: null }),
      { collectionType: "root" },
    );
    root = manager.root;
  });

  it("should correctly label collections based on content types", () => {
    // Add some oracle content
    manager.addLeafNodeAtPath(
      "oracles/storm/thunder",
      {
        kind: "content",
        data: { success: true, result: datasworn("oracle_rollable") },
      },
      true,
    );

    // Add move content
    manager.addLeafNodeAtPath(
      "moves/combat/strike",
      {
        kind: "content",
        data: { success: true, result: datasworn("move") },
      },
      true,
    );

    // Add asset content
    manager.addLeafNodeAtPath(
      "assets/companion",
      {
        kind: "content",
        data: { success: true, result: datasworn("asset") },
      },
      true,
    );

    // Add explicit index files
    manager.addLeafNodeAtPath(
      "oracles/_index",
      {
        kind: "index",
        data: { type: "oracle_collection" },
      },
      true,
    );

    const labels = labelCollections(root);

    // Convert to path-based map for easier testing
    const pathMap = new Map(
      [...labels.entries()].map(([node, label]) => [
        node.path,
        label.kind === "collection"
          ? label.allowableTypes.unwrapOr(["error"])
          : null,
      ]),
    );

    expect(pathMap.get("oracles")).toEqual(["oracle_collection"]);
    expect(pathMap.get("oracles/storm")).toEqual(["oracle_collection"]);
    expect(pathMap.get("oracles/storm/thunder")).toBeNull();
    expect(pathMap.get("moves")).toEqual(["move_category"]);
    expect(pathMap.get("moves/combat")).toEqual(["move_category"]);
    expect(pathMap.get("moves/combat/strike")).toBeNull();
    expect(pathMap.get("assets")).toEqual(["asset_collection"]);
    expect(pathMap.get("assets/companion")).toBeNull();
    expect(pathMap.get("")).toEqual(["root"]);
  });

  it("should handle conflicting collection types with error", () => {
    // Create a mixed collection with conflicting types
    manager.addLeafNodeAtPath(
      "mixed/oracle1",
      {
        kind: "content",
        data: { success: true, result: datasworn("oracle_rollable") },
      },
      true,
    );

    manager.addLeafNodeAtPath(
      "mixed/move1",
      {
        kind: "content",
        data: { success: true, result: datasworn("move") },
      },
      true,
    );

    const labels = labelCollections(root);

    // Check that the mixed folder has an error
    const mixedLabel = labels.get(manager.getNode("mixed")!)!;
    expect(
      unwrapErr((mixedLabel as CollectionLabel).allowableTypes).message,
    ).toMatch(/No valid collection types/);
  });

  it("should ignore error content when determining collection type", () => {
    manager.addLeafNodeAtPath(
      "broken/error-content",
      {
        kind: "content",
        data: { success: false, error: new Error("Parse error") },
      },
      true,
    );

    manager.addLeafNodeAtPath(
      "broken/valid-oracle",
      {
        kind: "content",
        data: { success: true, result: datasworn("oracle_rollable") },
      },
      true,
    );

    const labels = labelCollections(root);

    const pathMap = new Map(
      [...labels.entries()].map(([node, label]) => [node.path, label]),
    );

    expect(pathMap.get("broken")).toMatchObject({
      allowableTypes: ok(["oracle_collection"]),
    });
  });

  it("should handle empty groups", () => {
    manager.addGroupNodeAtPath("empty", { collectionType: null });

    const labels = labelCollections(root);

    expect(labels.getAtPath("empty")!).toMatchObject<Partial<NodeLabel>>({
      allowableTypes: ok(null),
      allowableParents: null,
    });
  });

  it("should handle package content", () => {
    manager.addLeafNodeAtPath(
      "ruleset",
      {
        kind: "package",
        package: { type: "ruleset", _id: "foo", datasworn_version: "0.1.0" },
      },
      true,
    );

    const labels = labelCollections(root);

    expect(labels.getAtPath("ruleset")!.kind).toEqual("package");
    expect(labels.getAtPath("")).toMatchObject<Partial<NodeLabel>>({
      allowableTypes: ok(null),
    });
  });

  it("should label intermediate collections ", () => {
    // Create oracle collection with a nested oracle collection
    manager.addLeafNodeAtPath(
      "base/weather/storm",
      contentNode("oracle_rollable"),
      true,
    );

    const labels = pathToTypes(labelCollections(root));

    expect(labels).toEqual(
      new Map([
        ["", ["root"]],
        ["base", ["oracle_collection"]],
        ["base/weather", ["oracle_collection"]],
      ]),
    );
  });

  // Note that we may eventually change this behavior, in which case, we'd want it
  // to restore the old behavior: labeling a node "root" if it does not have a
  // direct collection node associated with it.
  it("should disallow intermediate collections of mixed type.", () => {
    manager.addLeafNodeAtPath(
      "base/weather/storm",
      contentNode("oracle_rollable"),
      true,
    );

    manager.addLeafNodeAtPath("base/moves/xyz", contentNode("move"), true);

    const labels = pathToTypes(labelCollections(root));
    expect(labels.get("base")!).toBeInstanceOf(Error);
    expect(labels.get("base")!.toString()).toMatch(
      /No valid collection types found./,
    );
  });
});

function pathToTypes<L, G>(
  labels: Map<DataNode<L, G>, NodeLabel>,
): Map<string, CollectionTypes[] | Error | null> {
  return new Map(
    [...labels.entries()]
      .filter(
        (arg): arg is [DataNode<L, G>, CollectionLabel] =>
          arg[1].kind === "collection",
      )
      .map(([node, label]) => [
        node.path,
        label.allowableTypes.isErr
          ? label.allowableTypes.error
          : label.allowableTypes.value,
      ]),
  );
}
