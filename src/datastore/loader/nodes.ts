export abstract class BaseDataNode<L, G> {
  builder: NodeBuilder<L, G>;
  abstract type: "leaf" | "group";
  abstract path: string;
  abstract name: string;
  abstract parent: DataGroup<L, G> | null;

  constructor(builder: NodeBuilder<L, G>) {
    this.builder = builder;
  }
}

export class DataLeaf<L, G> extends BaseDataNode<L, G> {
  name!: string;
  path!: string;

  constructor(
    builder: NodeBuilder<L, G>,
    path: string,
    public parent: DataGroup<L, G>,
    public data: L,
  ) {
    super(builder);
    this.setPath(path);
  }
  get type(): "leaf" {
    return "leaf";
  }
  setPath(path: string): void {
    if (path == "") {
      throw new Error("Path cannot be empty.");
    }
    this.path = path;
    this.name = path.split("/").pop()!;
  }
}

export class DataGroup<L, G> extends BaseDataNode<L, G> {
  name!: string;
  path!: string;
  children: DataNode<L, G>[] = [];
  constructor(
    builder: NodeBuilder<L, G>,
    path: string,
    public parent: DataGroup<L, G> | null,
    public data: G,
  ) {
    super(builder);
    if (parent === null) {
      if (path !== "") {
        throw new Error("Root group must have an empty path.");
      }
      this.path = this.name = "";
    } else {
      this.setPath(path);
    }
  }

  get type(): "group" {
    return "group";
  }
  setPath(path: string): void {
    if (path == "") {
      throw new Error("Path cannot be empty.");
    }
    this.path = path;
    this.name = path.split("/").pop()!;
  }
  isRoot(): boolean {
    return this.parent === null;
  }

  walkDepthFirst(visitor: NodeVisitor<L, G>): void {
    visitor.enterGroup(this);
    for (const child of this.children) {
      if (child.type === "group") {
        child.walkDepthFirst(visitor);
      }
    }
    for (const child of this.children) {
      if (child.type === "leaf") {
        visitor.visitLeaf(child);
      }
    }
    visitor.leaveGroup(this);
  }
}

export type DataNode<L, G> = DataLeaf<L, G> | DataGroup<L, G>;

export type NodeVisitor<L, G> = {
  enterGroup: (group: DataGroup<L, G>) => void;
  visitLeaf: (leaf: DataLeaf<L, G>) => void;
  leaveGroup: (group: DataGroup<L, G>) => void;
};
/** Reduces a group starting at the leaves and working to the root. */

export function reduceNodes<L, G, RL, RG>(
  root: DataGroup<L, G>,
  reducer: {
    reduceLeaf: (leaf: DataLeaf<L, G>) => RL;
    reduceGroup: (
      group: DataGroup<L, G>,
      params: {
        groups: [DataGroup<L, G>, RG][];
        leaves: [DataLeaf<L, G>, RL][];
        children: Array<[DataLeaf<L, G>, RL] | [DataGroup<L, G>, RG]>;
      },
    ) => RG;
  },
): RG {
  const stack: {
    leaves: [DataLeaf<L, G>, RL][];
    groups: [DataGroup<L, G>, RG][];
  }[] = [{ leaves: [], groups: [] }]; // Start with an empty stack for the final result
  root.walkDepthFirst({
    enterGroup(_group) {
      stack.push({ leaves: [], groups: [] });
    },
    visitLeaf(leaf) {
      const reducedLeaf = reducer.reduceLeaf(leaf);
      if (stack.length === 0) {
        throw new Error("Unexpected leaf found without a group.");
      }
      stack[stack.length - 1].leaves.push([leaf, reducedLeaf]);
    },
    leaveGroup(group) {
      if (stack.length === 0) {
        throw new Error("Unexpected group found without a stack.");
      }
      const { leaves, groups } = stack.pop()!; // Get the children for this group
      const reducedGroup = reducer.reduceGroup(group, {
        groups,
        leaves,
        children: [...groups, ...leaves],
      });

      // Push the reduced group back to the parent group.
      stack[stack.length - 1].groups.push([group, reducedGroup]);
    },
  });
  if (stack.length === 0) {
    throw new Error("No root group found.");
  }
  if (stack.length > 1) {
    throw new Error("Unexpected nested groups found without a root.");
  }
  return stack[0].groups[0][1] as RG;
}
/** Applies a reducer but builds a map of the results as well. */

export function collectNodes<L, G, R, RL extends R = R, RG extends R = R>(
  root: DataGroup<L, G>,
  reducer: {
    reduceLeaf: (leaf: DataLeaf<L, G>) => RL;
    reduceGroup: (
      group: DataGroup<L, G>,
      params: {
        children: Array<[DataGroup<L, G>, RG] | [DataLeaf<L, G>, RL]>;
        groups: [DataGroup<L, G>, RG][];
        leaves: [DataLeaf<L, G>, RL][];
      },
    ) => RG;
  },
): NodeMap<L, G, R> {
  const results: NodeMap<L, G, R> = new NodeMap(root.builder);
  reduceNodes<L, G, RL, RG>(root, {
    reduceLeaf(leaf) {
      const reducedLeaf = reducer.reduceLeaf(leaf);
      results.set(leaf, reducedLeaf);
      return reducedLeaf;
    },
    reduceGroup(group, params) {
      const reducedGroup = reducer.reduceGroup(group, params);
      results.set(group, reducedGroup);
      return reducedGroup;
    },
  });
  return results;
}

export class NodeBuilder<L, G> {
  private nodes: Map<string, DataNode<L, G>> = new Map();

  constructor(
    public defaultGroupValue: () => G,
    rootValue: G = defaultGroupValue(),
  ) {
    // Initialize the root group
    const root = new DataGroup<L, G>(this, "", null, rootValue);
    this.nodes.set("", root);
  }

  /** Create a group node at a given path. */
  addGroupNodeAtPath(
    path: string,
    data: G,
    createIfMissing: boolean = false,
  ): DataGroup<L, G> {
    const segments = path.split("/");
    if (segments.length === 0 || segments[0] === "") {
      throw new Error("Path must not be empty.");
    }
    const existingNode = this.nodes.get(path);
    if (existingNode) {
      if (existingNode.type === "group") {
        // Update the data
        existingNode.data = data;
        return existingNode;
      }
      throw new Error(
        `Cannot create a group node at ${path} because a leaf node already exists at this path.`,
      );
    }

    const parentPath = segments.slice(0, -1).join("/"); // Get the parent path
    let parent = this.nodes.get(parentPath);
    if (parent && parent.type !== "group") {
      throw new Error(
        `Cannot create a group node at ${path} because ${parentPath} is a leaf.`,
      );
    } else if (!parent) {
      if (createIfMissing) {
        parent = this.addGroupNodeAtPath(
          parentPath,
          this.defaultGroupValue(),
          true,
        );
      } else {
        throw new Error(
          `Cannot create a group node at ${path} because the parent path ${parentPath} does not exist.`,
        );
      }
    }

    const newNode = new DataGroup<L, G>(this, path, parent, data);
    parent.children.push(newNode);
    this.nodes.set(path, newNode);
    return newNode;
  }

  /** Add a node at a given path, optionally creating any missing folders. */
  addLeafNodeAtPath(
    path: string,
    data: L,
    createIfMissing: boolean = false,
  ): DataLeaf<L, G> {
    const segments = path.split("/");
    if (segments.length === 0 || segments[0] === "") {
      throw new Error("Path must not be empty.");
    }
    const existingNode = this.nodes.get(path);
    if (existingNode) {
      if (existingNode.type === "leaf") {
        existingNode.data = data;
        return existingNode;
      }
      throw new Error(
        `Cannot create a leaf node at ${path} because a group node already exists at this path.`,
      );
    }

    const parentPath = segments.slice(0, -1).join("/"); // Get the parent path
    let parent = this.nodes.get(parentPath);
    if (parent && parent.type !== "group") {
      throw new Error(
        `Cannot create a leaf node at ${path} because ${parentPath} is a leaf.`,
      );
    } else if (!parent) {
      if (createIfMissing) {
        // Create the parent group if it doesn't exist
        parent = this.addGroupNodeAtPath(
          parentPath,
          this.defaultGroupValue(),
          true,
        );
      } else {
        throw new Error(
          `Cannot create a leaf node at ${path} because the parent path ${parentPath} does not exist.`,
        );
      }
    }

    // Create the new leaf node
    const newNode = new DataLeaf<L, G>(this, path, parent, data);
    parent.children.push(newNode);
    this.nodes.set(path, newNode);
    return newNode;
  }

  /** Look for the longest prefix that currently exists. */
  findLongestPrefix(path: string): DataNode<L, G> | null {
    const segments = path.split("/");

    for (let i = segments.length; i > 0; i--) {
      const prefix = segments.slice(0, i).join("/");
      const node = this.nodes.get(prefix);
      if (node) {
        return node;
      }
    }

    return null;
  }

  getNode(path: string): DataNode<L, G> | undefined {
    return this.nodes.get(path);
  }

  get root(): DataGroup<L, G> {
    return this.nodes.get("") as DataGroup<L, G>;
  }
}

export interface NodeRwMap<L, G, V> extends Map<DataNode<L, G>, V> {
  getAtPath(path: string): V | undefined;
  setAtPath(path: string, value: V): this;
}

export class NodeMap<L, G, V>
  extends Map<DataNode<L, G>, V>
  implements NodeRwMap<L, G, V>
{
  constructor(
    private builder: NodeBuilder<L, G>,
    ...args: ConstructorParameters<typeof Map<DataNode<L, G>, V>>
  ) {
    super(...args);
  }

  getAtPath(path: string): V | undefined {
    const node = this.builder.getNode(path);
    return node && this.get(node); // Return the value associated with the node
  }

  setAtPath(path: string, value: V): this {
    const node = this.builder.getNode(path);
    if (!node) {
      throw new Error(`No node found at path: ${path}`);
    }
    return this.set(node, value); // Set the value for the node
  }
}
