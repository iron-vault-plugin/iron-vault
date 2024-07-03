import * as kdl from "kdljs";
import {
  ActorDescription,
  ActorEqualityChecker,
  createActorNode,
  extractActorFromName,
  sameActorsDirect,
} from "./actor";

function parseMechanicsBlock(block: string): kdl.Document {
  const parsed = kdl.parse(block);
  if (parsed.errors.length > 0 || !parsed.output) {
    // TODO: maybe if this happens, it's a sign that we should just insert the block as a new block?
    throw new Error(`Error while parsing mechanics block: ${block}`, {
      cause: parsed.errors,
    });
  }
  return parsed.output;
}

export type KdlDocumentTransform = (doc: kdl.Document) => kdl.Document;

/** Transforms a string as KDL. */
export function transformAsKdl(
  transform: KdlDocumentTransform,
): (input: string | undefined) => string {
  return (input) =>
    kdl.format(transform(input ? parseMechanicsBlock(input) : []));
}

export function logged(
  msg: string,
  transform: KdlDocumentTransform,
): KdlDocumentTransform {
  return (doc) => {
    console.log(`${msg}: input:`, doc);
    const ret = transform(doc);
    console.log(`${msg}: output:`, ret);
    return ret;
  };
}

export function usingActor(
  actor: ActorDescription | undefined,
  transform: KdlDocumentTransform,
  actorsAreEqual: ActorEqualityChecker = sameActorsDirect,
): KdlDocumentTransform {
  if (!actor) return transform;

  return (doc): kdl.Document => {
    const lastIndex = doc.length - 1;
    const lastEntry = doc[lastIndex];
    if (
      lastIndex >= 0 &&
      lastEntry.name === "actor" &&
      lastEntry.properties.name != null &&
      actorsAreEqual(
        actor,
        extractActorFromName(lastEntry.properties.name.toString()),
      )
    ) {
      // The last node is a matching actor node, so let's apply the transform to its children.
      return [
        ...doc.slice(0, lastIndex),
        { ...lastEntry, children: transform(lastEntry.children) },
      ];
    } else {
      // The last node is not a matching actor node, so let's create a new actor-wrapped last node
      // and apply the transform to an empty doc.
      return [...doc, createActorNode(actor, transform([]))];
    }
  };
}

/** Appends nodes to an existing mechanics block or inserts a new block. */
export function appendNodes(newItems: kdl.Node[]): KdlDocumentTransform {
  return (nodes) => [...nodes, ...newItems];
}

/** Allows adding to previous move or creating a new mechanics block. */
export function updatePreviousMoveOrCreate(
  update: (moveNode: kdl.Node) => kdl.Node,
  createTopLevel: () => kdl.Node[],
): KdlDocumentTransform {
  return (output) => {
    // If the last node is a move, update it. Otherwise, create a new top-level node.
    const lastIndex = output.length - 1;
    if (lastIndex >= 0 && output[lastIndex].name == "move") {
      return [...output.slice(0, lastIndex), update(output[lastIndex])];
    } else {
      return [...output, ...createTopLevel()];
    }
  };
}

/** Adds nodes to the end of a preceding move or block, or creates a new block. */
export function appendNodesToMoveOrTopLevel(
  ...nodes: kdl.Node[]
): KdlDocumentTransform {
  return updatePreviousMoveOrCreate(
    (move) => ({
      ...move,
      children: [...move.children, ...nodes],
    }),
    () => nodes,
  );
}
