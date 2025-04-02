import { parserForFrontmatter, ParserReturn } from "datastore/parsers/markdown";
import * as yaml from "yaml";

import { DataswornSource } from "@datasworn/core";
import { produce } from "immer";
import { rootLogger } from "logger";
import { WILDCARD_TARGET_RULESET_PLACEHOLDER } from "rules/ruleset";
import { Either, Left, Right } from "utils/either";
import { childOfPath } from "utils/paths";

const logger = rootLogger.getLogger("content-indexer");

export type Content = {
  path: string;
  mtime: number;
  hash: Uint8Array;
  value:
    | { kind: "content"; data: ParserReturn }
    | { kind: "package"; package: DataswornSource.RulesPackage }
    | { kind: "index"; data: Record<string, unknown> };
};

type ContentIndex = Map<string, Content>;

class FilePath {
  constructor(public path: string) {}

  /** Get the extension */
  get extension(): string {
    const parts = this.path.split(".");
    return parts.length > 1 ? parts.pop() || "" : "";
  }

  /** Get the file name without the extension. */
  get basename(): string {
    const parts = this.path.split("/");
    const filename = parts.pop() || ""; // Get the last part of the path
    const nameWithoutExt = filename.split(".").slice(0, -1).join("."); // Remove the extension
    return nameWithoutExt;
  }

  toString(): string {
    return this.path;
  }

  equals(other: FilePath): boolean {
    return this.path === other.path;
  }
}

export class ContentIndexer {
  constructor(private manager: ContentManager) {}

  private async computeHash(data: string): Promise<Uint8Array> {
    const textEncoder = new TextEncoder();
    const encodedData = textEncoder.encode(data);

    // Use the SubtleCrypto API to compute the SHA-256 hash
    return new Uint8Array(await crypto.subtle.digest("SHA-256", encodedData));
  }

  #parseIndexFile(
    filePath: FilePath,
    data: string,
    frontmatter: Record<string, unknown> | undefined,
  ): Content["value"] | null {
    if (filePath.extension == "md") {
      return { kind: "index", data: frontmatter ?? {} };
    } else if (filePath.extension == "yml" || filePath.extension == "yaml") {
      try {
        return {
          kind: "index",
          data: yaml.parse(data, {
            schema: "core",
            merge: true,
            maxAliasCount: 1000,
          }),
        };
      } catch (e) {
        logger.error(
          "[homebrew-indexer:%s] Failed to parse YAML file %s. Errors: %o",
          "todo", // root should go here?
          filePath.path,
          e,
        );
        // TODO: this is an index, but we're setting it as content, because that's where error lives. hrm.
        return {
          kind: "content",
          data: {
            success: false,
            error: new Error(`Failed to parse YAML file ${filePath.path}`),
          },
        };
      }
    } else {
      logger.error(
        "[homebrew-indexer:%s] Unexpected file type for index file %s",
        "todo", // root should go here?
        filePath.path,
      );
      // If we encounter an unexpected file type, we can return null
      // to indicate that it is not a valid index file.
      return null;
    }
  }

  async #parse(
    filePath: FilePath,
    data: string,
    frontmatter: Record<string, unknown> | undefined,
  ): Promise<Content["value"] | null> {
    if (filePath.basename == "_index") {
      return this.#parseIndexFile(filePath, data, frontmatter);
    }

    if (filePath.extension == "md") {
      // TODO: maybe I should break this into two stages: a "can index" stage
      // and a "parse content" stage. That way I can avoid sending the content
      // if we aren't going to need it.
      const parser = parserForFrontmatter(filePath.path, frontmatter);
      if (parser) {
        return {
          kind: "content",
          data: parser(data, filePath.basename, frontmatter),
        };
      }
    } else if (filePath.extension == "yml" || filePath.extension == "yaml") {
      logger.debug("[homebrew:%s] Found YAML file %s", "todo", filePath.path);

      let result;
      try {
        result = yaml.parse(data, {
          schema: "core",
          merge: true,
          maxAliasCount: 1000,
        });
      } catch (e) {
        logger.error(
          "[homebrew-collection:%s] Failed to parse YAML file %s. Errors: %o",
          "todo",
          filePath.path,
          e,
        );
        return {
          kind: "content",
          data: {
            success: false,
            error: new Error(
              `Failed to parse YAML file ${filePath.path}: ${e}`,
            ),
          },
        };
      }

      const dataType = (result as DataswornSource.SourceRoot).type;
      switch (dataType) {
        case "oracle_rollable":
        case "asset":
        case "move": {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { datasworn_version, ruleset, ...dataWithoutRootFields } =
            result;
          return {
            kind: "content",
            data: {
              success: true,
              // TODO: this isn't accounting for oracle column rollables
              result: dataWithoutRootFields,
            },
          };
        }
        case "ruleset":
        case "expansion":
          // TODO: should maybe validate it here
          return {
            kind: "package",
            package: result as DataswornSource.RulesPackage,
          };
        default:
          logger.error(
            "[homebrew-collection:%s] Unexpected file type %s in file %s",
            "todo",
            (result as DataswornSource.SourceRoot).type,
            filePath.path,
          );
          return {
            kind: "content",
            data: {
              success: false,
              error: new Error(
                `Unexpected file type ${result.type} in file ${filePath.path}`,
              ),
            },
          };
      }
    }
    return null;
  }

  async indexFile(
    path: string,
    mtime: number,
    data: string,
    frontmatter: Record<string, unknown> | undefined,
  ): Promise<void> {
    // TODO: if i have a 'can/should index', it could check the mtime and skip
    // sending the content
    const existing = this.manager.getContent(path);
    if (existing && existing.mtime >= mtime) {
      logger.debug(
        "[content-indexer] File %s has not changed. Skipping re-index.",
        path,
      );
      return; // No change in file, skip re-indexing
    }

    const hash = await this.computeHash(data);
    if (existing != null && existing.hash == hash) {
      logger.debug(
        "[content-indexer] File %s has not changed. Skipping re-index.",
        path,
      );
      return; // No change in content, skip re-indexing
    }

    const filePath = new FilePath(path);
    const value = await this.#parse(filePath, data, frontmatter);
    if (value === null) {
      logger.error(
        "[content-indexer] Failed to parse file %s. No valid content found.",
        path,
      );
      return; // No valid content found, do not add to index
    }

    const content: Content = {
      path,
      mtime,
      hash,
      value,
    };
    this.manager.addContent(content);
  }
}

export class ContentManager {
  private contentIndex: ContentIndex;
  private roots: Set<string> = new Set();
  private updateRootCallback: (root: string, content: Content[]) => unknown =
    () => {};

  constructor() {
    this.contentIndex = new Map();
  }

  onUpdateRoot(callback: (root: string, content: Content[]) => unknown): void {
    this.updateRootCallback = callback;
  }

  addRoot(path: string): void {
    const existingRoot = this.rootForPath(path);
    if (existingRoot === path) {
      logger.debug(
        "[content-manager] Root path %s is already registered.",
        path,
      );
      return; // Already registered as a root
    } else if (existingRoot) {
      logger.error(
        "[content-manager] Path %s is already under root %s.",
        path,
        existingRoot,
      );
      throw new Error(
        `Path ${path} is already under root ${existingRoot}. Cannot register as a new root.`,
      ); // Cannot register a new root under an existing one
    }

    this.roots.add(path);

    this.#updateRoot(path);
  }

  #updateRoot(root: string): void {
    const content = [...this.valuesUnderPath(root)];
    logger.debug(
      "[content-manager] Updating root %s with %d content items.",
      root,
      content.length,
    );
    this.updateRootCallback(root, content);
  }

  #updateRootForPath(path: string): void {
    const root = this.rootForPath(path);
    if (root) {
      logger.debug(
        "[content-manager] Updating root for path %s under root %s.",
        path,
        root,
      );
      this.#updateRoot(root);
    } else {
      logger.debug(
        "[content-manager] No root found for path %s. Cannot update.",
        path,
      );
    }
  }

  removeRoot(path: string): void {
    this.roots.delete(path);
  }

  getContent(path: string): Content | undefined {
    return this.contentIndex.get(path);
  }

  addContent(content: Content): void {
    this.contentIndex.set(content.path, content);
    this.#updateRootForPath(content.path);
  }

  deleteContent(path: string): boolean {
    if (this.contentIndex.delete(path)) {
      this.#updateRootForPath(path);
      return true;
    }
    return false;
  }

  renameContent(oldPath: string, newPath: string): boolean {
    const content = this.contentIndex.get(oldPath);
    if (content) {
      content.path = newPath;
      this.contentIndex.delete(oldPath);
      this.contentIndex.set(newPath, content);
      const oldRoot = this.rootForPath(oldPath);
      const newRoot = this.rootForPath(newPath);
      if (oldRoot) {
        this.#updateRoot(oldRoot);
      }
      // If the new path is under a different root, we need to update that root as well.
      if (newRoot && newRoot !== oldRoot) {
        this.#updateRoot(newRoot);
      }
      return true;
    }
    return false;
  }

  *valuesUnderPath(path: string): Generator<Content> {
    for (const [key, content] of this.contentIndex.entries()) {
      if (childOfPath(path, key)) {
        yield content;
      }
    }
  }

  rootForPath(path: string): string | undefined {
    for (const root of this.roots) {
      if (childOfPath(root, path)) {
        return root;
      }
    }
    return undefined;
  }
}

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

export type CollectionTypes =
  | DataswornSource.OracleCollection["type"]
  | DataswornSource.MoveCategory["type"]
  | DataswornSource.AssetCollection["type"]
  | "root";

export type DataswornSourceTypes = {
  oracle_rollable: DataswornSource.OracleRollableTable;
  move: DataswornSource.Move;
  asset: DataswornSource.Asset;
};

export type EntryTypes = keyof DataswornSourceTypes;

export function isDataswornSourceOfType<L extends EntryTypes>(
  type: L,
  obj: DataswornSourceTypes[keyof DataswornSourceTypes],
): obj is DataswornSourceTypes[L] {
  return (obj as { type: string }).type === type;
}

export const ENTRY_TYPES: EntryTypes[] = ["oracle_rollable", "move", "asset"];

export const COLLECTION_TYPES: CollectionTypes[] = [
  "oracle_collection",
  "move_category",
  "asset_collection",
];

export const COLLECTION_TYPES_WITH_ROOT: CollectionTypes[] = [
  ...COLLECTION_TYPES,
  "root",
];

const parentForEntry: Record<EntryTypes, CollectionTypes> = {
  oracle_rollable: "oracle_collection",
  move: "move_category",
  asset: "asset_collection",
};

const parentForCollection: Record<CollectionTypes, CollectionTypes[]> = {
  oracle_collection: ["oracle_collection", "root"],
  move_category: ["move_category", "root"],
  asset_collection: ["asset_collection", "root"],
  root: ["root"],
};

export type CollectionAnnotations = {
  collectionType: CollectionTypes | null;
};

export class PackageBuilder {
  labels: NodeMap<Content["value"], CollectionAnnotations, NodeLabel>;

  static fromContent(root: string, content: Iterable<Content>): PackageBuilder {
    const builder = new NodeBuilder<Content["value"], CollectionAnnotations>(
      () => ({ collectionType: null }),
      { collectionType: "root" },
    );

    for (const item of content) {
      builder.addLeafNodeAtPath(item.path, item.value, true);
    }

    const rootNode = builder.getNode(root);
    if (rootNode?.type !== "group") {
      throw new Error(`Root path "${root}" is not a valid group node.`);
    }

    return new PackageBuilder(rootNode);
  }

  constructor(
    private root: DataGroup<Content["value"], CollectionAnnotations>,
  ) {
    this.labels = labelCollections(root);
  }

  build(): [string, Either<Error, DataswornSource.RulesPackage>][] {
    // TODO: set actual meaningful values from... somewhere
    const source: DataswornSource.SourceInfo = {
      authors: [{ name: "TODO" }],
      date: "0000-00-00",
      license: null,
      title: this.root.name,
      url: "https://example.com",
    };
    // TODO: allow creating full ruleset
    const packageData: DataswornSource.Expansion = {
      ...source,
      datasworn_version: "0.1.0",
      type: "expansion",
      ruleset: WILDCARD_TARGET_RULESET_PLACEHOLDER,
      _id: sanitizeNameForId(this.root.name),
    };

    return this.root.children.flatMap((child) =>
      this.buildTopCollection(child, packageData, source),
    );
  }

  buildTopCollection(
    node: DataNode<Content["value"], CollectionAnnotations>,
    parent: DataswornSource.Expansion,
    parentSource: DataswornSource.SourceInfo,
  ): [string, Either<Error, DataswornSource.RulesPackage>][] {
    const groupTypeResult = this._getGroupType(node);
    if (groupTypeResult.isLeft()) {
      return [[node.path, groupTypeResult]];
    }

    if (node.type !== "group") throw new Error("this can't happen");

    const collectionType = groupTypeResult.value;
    switch (collectionType) {
      case "oracle_collection":
        return this.buildOracleCollection(
          node,
          parentSource,
          (key, collection) =>
            produce(parent, (draft) => {
              draft.oracles ??= {};
              draft.oracles[key] = collection;
            }),
        );
      case "move_category":
        return this.buildMoveCategory(node, parentSource, (key, collection) =>
          produce(parent, (draft) => {
            draft.moves ??= {};
            draft.moves[key] = collection;
          }),
        );
      case "asset_collection":
        return this.buildAssetCollection(
          node,
          parentSource,
          (key, collection) =>
            produce(parent, (draft) => {
              draft.assets ??= {};
              draft.assets[key] = collection;
            }),
        );
      default:
        return [
          [
            node.path,
            Left.create(
              new Error("Unexpected collection type: " + collectionType),
            ),
          ],
        ];
    }
  }

  _getGroupType(
    node: DataNode<Content["value"], CollectionAnnotations>,
  ): Either<Error, CollectionTypes> {
    if (node.type === "leaf") {
      return Left.create(new Error("Expected a group node"));
    }

    // Now check the labels for this collection
    const label = this.labels.get(node);
    if (label == null || label.kind !== "collection") {
      return Left.create(new Error("Expected a collection node"));
    }

    const allowableTypes = label.allowableTypes;
    if (allowableTypes.isLeft()) {
      return allowableTypes;
    }

    const collectionTypes = allowableTypes.value ?? [];
    if (collectionTypes.length != 1) {
      return Left.create(
        new Error(
          `Expected exactly one collection type, but found ${collectionTypes}.`,
        ),
      );
    }
    return Right.create(collectionTypes[0]);
  }

  checkType(
    node: DataGroup<Content["value"], CollectionAnnotations>,
    expected: CollectionTypes,
  ): Left<Error> | undefined {
    const groupType = this._getGroupType(node);
    if (groupType.isLeft()) {
      return groupType;
    }
    if (groupType.value !== expected) {
      return Left.create(
        new Error(
          `Expected a ${expected} collection, but found a ${groupType.value} collection.`,
        ),
      );
    }
    return undefined;
  }

  buildOracleCollection<T>(
    node: DataGroup<Content["value"], CollectionAnnotations>,
    parentSource: DataswornSource.SourceInfo,
    builder: (
      key: string,
      collection: DataswornSource.OracleTablesCollection,
    ) => T,
  ): [string, Either<Error, T>][] {
    const error = this.checkType(node, "oracle_collection");
    if (error) {
      return [[node.path, error]];
    }

    const index = this._getIndex(node);
    const attributes =
      index != null && index.data.kind == "index" ? index.data.data : {};
    const collectionName = node.name;
    const oracleCollection: DataswornSource.OracleTablesCollection = {
      ...attributes,
      oracle_type: "tables",
      type: "oracle_collection",
      name: (attributes.name as string) ?? collectionName,
      // TODO: we should have validated this? Maybe push this info up the labels?
      _source:
        (attributes["_source"] as DataswornSource.SourceInfo) ?? parentSource,
    };
    const thisKey = sanitizeNameForId(node.name);

    return node.children.flatMap((child) =>
      child.type === "group"
        ? this.buildOracleCollection(
            child,
            oracleCollection._source,
            (key, subcollection) =>
              builder(
                thisKey,
                produce(oracleCollection, (draft) => {
                  draft.collections ??= {};
                  draft.collections[key] = subcollection;
                }),
              ),
          )
        : this.buildLeaf("oracle_rollable", child, (key, subcollection) =>
            builder(
              thisKey,
              produce(oracleCollection, (draft) => {
                draft.contents ??= {};
                draft.contents[key] = subcollection;
              }),
            ),
          ),
    );
  }

  buildLeaf<L extends EntryTypes, T>(
    leafType: L,
    node: DataLeaf<Content["value"], CollectionAnnotations>,
    builder: (key: string, table: DataswornSourceTypes[L]) => T,
  ): [string, Either<Error, T>][] {
    // Index nodes are not leaves in the sense of content, so we skip them
    if (node.data.kind === "index") {
      return [];
    } else if (node.data.kind === "package") {
      // TODO: this as T implies that something is off. I think T should just be
      // DataswornSource.RulesPackage everywhere?
      return [[node.path, Right.create(node.data.package as T)]];
    } else if (node.data.kind !== "content") {
      return [[node.path, Left.create(new Error("Expected content"))]];
    }
    if (!node.data.data.success) {
      return [[node.path, Left.create(node.data.data.error)]];
    }

    const attributes = node.data.data.result;
    if (!isDataswornSourceOfType(leafType, attributes)) {
      return [
        [
          node.path,
          Left.create(
            new Error(
              `Expected a ${leafType}, but found a ${attributes.type}.`,
            ),
          ),
        ],
      ];
    }

    return [
      [
        node.path,
        Right.create(builder(sanitizeNameForId(node.name), attributes)),
      ],
    ];
  }

  buildMoveCategory<T>(
    node: DataGroup<Content["value"], CollectionAnnotations>,
    parentSource: DataswornSource.SourceInfo,
    builder: (key: string, collection: DataswornSource.MoveCategory) => T,
  ): [string, Either<Error, T>][] {
    const error = this.checkType(node, "move_category");
    if (error) {
      return [[node.path, error]];
    }

    const index = this._getIndex(node);
    const attributes =
      index != null && index.data.kind == "index" ? index.data.data : {};
    const collectionName = node.name;
    const moveCategory: DataswornSource.MoveCategory = {
      ...attributes,
      type: "move_category",
      name: (attributes.name as string) ?? collectionName,
      // TODO: we should have validated this? Maybe push this info up the labels?
      _source:
        (attributes["_source"] as DataswornSource.SourceInfo) ?? parentSource,
    };

    const thisKey = sanitizeNameForId(node.name);
    return node.children.flatMap((child) =>
      child.type === "group"
        ? this.buildMoveCategory(
            child,
            moveCategory._source,
            (key, subcollection) =>
              builder(
                thisKey,
                produce(moveCategory, (draft) => {
                  draft.collections ??= {};
                  draft.collections[key] = subcollection;
                }),
              ),
          )
        : this.buildLeaf("move", child, (key, leaf) =>
            builder(
              thisKey,
              produce(moveCategory, (draft) => {
                draft.contents ??= {};
                draft.contents[key] = leaf;
              }),
            ),
          ),
    );
  }

  buildAssetCollection<T>(
    node: DataGroup<Content["value"], CollectionAnnotations>,
    parentSource: DataswornSource.SourceInfo,
    builder: (key: string, collection: DataswornSource.AssetCollection) => T,
  ): [string, Either<Error, T>][] {
    const error = this.checkType(node, "asset_collection");
    if (error) {
      return [[node.path, error]];
    }

    const index = this._getIndex(node);
    const attributes =
      index != null && index.data.kind == "index" ? index.data.data : {};
    const collectionName = node.name;
    const assetCollection: DataswornSource.AssetCollection = {
      ...attributes,
      type: "asset_collection",
      name: (attributes.name as string) ?? collectionName,
      // TODO: we should have validated this? Maybe push this info up the labels?
      _source:
        (attributes["_source"] as DataswornSource.SourceInfo) ?? parentSource,
    };
    const thisKey = sanitizeNameForId(node.name);

    return node.children.flatMap((child) =>
      child.type === "group"
        ? this.buildAssetCollection(
            child,
            assetCollection._source,
            (key, subcollection) =>
              builder(
                thisKey,
                produce(assetCollection, (draft) => {
                  draft.collections ??= {};
                  draft.collections[key] = subcollection;
                }),
              ),
          )
        : this.buildLeaf("asset", child, (key, leaf) =>
            builder(
              thisKey,
              produce(assetCollection, (draft) => {
                draft.contents ??= {};
                draft.contents[key] = leaf;
              }),
            ),
          ),
    );
  }
  _getIndex(group: DataGroup<Content["value"], CollectionAnnotations>) {
    const node = group.children.find(
      (child) => this.labels.get(child)?.kind === "index",
    );
    return node?.type === "leaf" ? node : null;
  }
}

export type LeafLabel =
  | {
      kind: "leaf";
      leafType: EntryTypes | null; // The type of the leaf node, or null if not applicable
      allowableParents: CollectionTypes[] | null;
    }
  | {
      kind: "package";
      allowableParents: null;
    }
  | { kind: "index"; allowableParents: CollectionTypes[] | null }; // For index files, we can have a collection type

export type CollectionLabel = {
  kind: "collection";
  allowableTypes: Either<Error, CollectionTypes[] | null>; // The type of the collection node
  allowableParents: CollectionTypes[] | null;
};

export type NodeLabel = LeafLabel | CollectionLabel;
export function labelCollections(
  tree: DataGroup<Content["value"], CollectionAnnotations>,
): NodeMap<Content["value"], CollectionAnnotations, NodeLabel> {
  const labels: NodeMap<Content["value"], CollectionAnnotations, NodeLabel> =
    collectNodes(tree, {
      reduceLeaf(leaf): LeafLabel {
        // We weirdly treat the leaf as a whole collection of a specific type.
        // This works because collections of a specific type can only be contained
        // by collections of those types (or the root).
        switch (leaf.data.kind) {
          case "content":
            if (leaf.data.data.success) {
              const entry = leaf.data.data.result;
              const entryType = entry.type;
              return {
                kind: "leaf",
                leafType: entryType,
                allowableParents: [parentForEntry[entryType]],
              }; // Leaf node with a specific type
            }
            return { kind: "leaf", leafType: null, allowableParents: null }; // Error in content parsing, no collection type
          case "package":
            // TODO: what should this be
            return { kind: "package", allowableParents: null }; // Root package
          case "index":
            // TODO: should validate somewhere that this has a valid collection type?
            return leaf.data.data.type != null &&
              typeof leaf.data.data.type == "string" &&
              leaf.data.data.type in parentForCollection
              ? {
                  kind: "index",
                  allowableParents: [leaf.data.data.type as CollectionTypes],
                }
              : { kind: "index", allowableParents: COLLECTION_TYPES }; // Index file with no specific collection type

          default:
            return { kind: "leaf", allowableParents: null, leafType: null }; // Unknown type, no leaf type
        }
      },
      reduceGroup(group, { children }): CollectionLabel {
        // All types that are valid for this group.
        // If we have a collection type already, that will be the only kind we accept.
        // Otherwise, we start with every possible collection type.

        // Note: the Datasworn ID parser assumes that every group corresponds to a collection,
        // so we exclude "root" here. If we wished to allow intermediate levels, we could allow
        // root here-- but then we'd also have to walk the tree once again to ensure we don't
        // sandwich a "root" between two concrete types.
        const allowableTypes: Set<CollectionTypes> = new Set(
          group.data.collectionType
            ? [group.data.collectionType]
            : COLLECTION_TYPES,
        );

        for (const [, { allowableParents }] of children) {
          if (allowableParents == null) continue;
          // We want to intersect the allowable types for this collection with the allowable
          // parents of this child.
          for (const existingType of allowableTypes) {
            if (!allowableParents.includes(existingType)) {
              // If the allowable parents do not include the existing type, we need to remove it.
              allowableTypes.delete(existingType);
            }
          }
        }

        if (allowableTypes.size === 0) {
          // If we have no allowable types, we cannot have a collection.
          return {
            kind: "collection",
            allowableTypes: Left.create(
              new Error(
                "No valid collection types found. Children require incompatible types: " +
                  [
                    ...new Set(
                      children.map(([, { allowableParents }]) =>
                        (allowableParents ?? ["any"]).toString(),
                      ),
                    ),
                  ].join("; "),
              ),
            ),
            allowableParents: null,
          };
        }

        // If the only allowable type is root, this better be the root node.
        if (allowableTypes.size === 1 && allowableTypes.has("root")) {
          if (group !== tree) {
            return {
              kind: "collection",
              allowableTypes: Left.create(
                new Error("Only the root can be of type 'root'."),
              ),
              allowableParents: null,
            };
          }
        }

        const allowableParents = [
          ...new Set(
            [...allowableTypes.values()].flatMap(
              (type) => parentForCollection[type],
            ),
          ),
        ];
        return {
          kind: "collection",
          allowableTypes: Right.create([...allowableTypes]),
          allowableParents,
        };
      },
    });

  return labels;
}

export function mapValues<K, V, U>(
  map: Map<K, V>,
  transform: (value: V, key: K) => U,
): Map<K, U> {
  return new Map(
    map.entries().map(([key, value]) => [key, transform(value, key)]),
  );
}

const numbers = [
  "zero",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
].map((s) => "_" + s + "_");

export function sanitizeNameForId(name: string): string {
  return name
    .replaceAll(/[0-9]/g, (digit) => numbers[Number.parseInt(digit)])
    .replaceAll(/[^a-z]+/gi, "_")
    .replaceAll(/^_|_$/g, "")
    .toLowerCase();
}
