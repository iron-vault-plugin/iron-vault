import { matchDataswornLink } from "datastore/parsers/datasworn/id";
import * as kdl from "kdljs";

export function isMoveNode(
  node: kdl.Node,
): node is kdl.Node & { name: "move" } {
  return node.name == "move";
}

export function assertIsMoveNode(
  node: kdl.Node,
): asserts node is kdl.Node & { name: "move" } {
  if (!isMoveNode(node)) {
    throw new Error(`Expected 'move' node, received ${node}`);
  }
}

/** Get move ID from a move node. Returns undefined if not a move node. */
export function getMoveIdFromNode(node: kdl.Node): string | undefined {
  if (!isMoveNode(node)) return undefined;
  if (node.properties["id"] && typeof node.properties["id"] == "string")
    return node.properties["id"];
  if (node.values.length > 0 && typeof node.values[0] == "string") {
    return matchDataswornLink(node.values[0])?.id;
  }

  return undefined;
}

/** Returns the last node in a block is a move node. */
export function getTerminalMoveNode(
  doc: kdl.Document,
): (kdl.Node & { name: "move" }) | undefined {
  if (doc.length == 0) return undefined;
  const lastNode = doc[doc.length - 1];
  return isMoveNode(lastNode) ? lastNode : undefined;
}
