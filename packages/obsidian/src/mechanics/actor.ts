// export function activeActor(plugin: IronVaultPlugin, charContext: ActionContext):

import { Node, node } from "utils/kdl";

export type ActorDescription = {
  /** Source path for this actor. */
  path?: string;

  /** Name for this actor. */
  name: string;
};

export const ACTOR_NAME_REGEX =
  /\[\[(?<path>[^|#[\]]+)(?:\|(?<name>[^|[\]]*))?\]\]/;

export function formatActorName({ path, name }: ActorDescription): string {
  return path ? `[[${path}|${name}]]` : name;
}

export function extractActorFromName(name: string): ActorDescription {
  const match = name.match(ACTOR_NAME_REGEX);
  if (match) {
    return {
      path: match.groups!.path,
      name: match.groups!.name || match.groups!.path,
    };
  } else {
    return { name: name };
  }
}

export type ActorEqualityChecker = (
  left: ActorDescription,
  right: ActorDescription,
) => boolean;

export const sameActorsDirect: ActorEqualityChecker = (left, right) =>
  (left.path != null && right.path != null && left.path == right.path) ||
  ((left.path == null || right.path == null) && left.name == right.name);

export function wrapActor(
  actor: ActorDescription | undefined,
  nodes: Node[],
): Node[] {
  if (actor != null) {
    return [createActorNode(actor, nodes)];
  } else {
    return nodes;
  }
}

export function createActorNode(
  actor: ActorDescription,
  children: Node[],
): Node {
  return node("actor", {
    properties: {
      name: formatActorName(actor),
    },
    children,
  });
}
