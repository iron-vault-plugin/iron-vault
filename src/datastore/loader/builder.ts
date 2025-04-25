import {
  MarkdownDataParser,
  ParserReturn,
  PARSERS_BY_TYPE,
} from "datastore/parsers/markdown";
import * as yaml from "yaml";

import { Datasworn, DataswornSource } from "@datasworn/core";
import { RulesPackageBuilder } from "@datasworn/core/dist/Builders";
import { ErrorObject } from "ajv";
import { SchemaValidationFailedError } from "datastore/parsers/collection";
import { produce } from "immer";
import { rootLogger } from "logger";
import {
  WILDCARD_TARGET_RULESET,
  WILDCARD_TARGET_RULESET_PLACEHOLDER,
} from "rules/ruleset";
import { Either, Left, Right } from "utils/either";
import { numbers } from "utils/numbers";
import { childOfPath, findTopLevelParentPath } from "utils/paths";
import { PLUGIN_DATASWORN_VERSION } from "../../constants";
import {
  collectNodes,
  DataGroup,
  DataLeaf,
  DataNode,
  NodeBuilder,
  NodeMap,
  reduceNodes,
} from "./nodes";

const logger = rootLogger.getLogger("content-indexer");
logger.setDefaultLevel("debug");

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
  constructor(private manager: IContentManager) {}

  static async computeHash(data: string): Promise<Uint8Array> {
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

  #parse(
    filePath: FilePath,
    data: string,
    frontmatter: Record<string, unknown> | undefined,
  ): Content["value"] | null {
    if (filePath.basename == "_index") {
      return this.#parseIndexFile(filePath, data, frontmatter);
    }

    if (filePath.extension == "md") {
      // TODO: maybe I should break this into two stages: a "can index" stage
      // and a "parse content" stage. That way I can avoid sending the content
      // if we aren't going to need it.
      const contentType =
        typeof frontmatter?.["type"] == "string"
          ? frontmatter["type"]
          : undefined;
      const parser: MarkdownDataParser | undefined =
        PARSERS_BY_TYPE[contentType ?? ""];
      if (parser) {
        return {
          kind: "content",
          data: parser(data, filePath.basename, frontmatter),
        };
      } else {
        return {
          kind: "content",
          data: {
            success: false,
            error: new Error(
              `Could not determine parser for file ${filePath.path} (type: ${contentType}).`,
            ),
            result: { type: contentType },
          },
        };
      }
    } else if (
      filePath.extension == "yml" ||
      filePath.extension == "yaml" ||
      filePath.extension == "json"
    ) {
      let result;

      if (filePath.extension == "yml" || filePath.extension == "yaml") {
        logger.debug("[homebrew:%s] Found YAML file %s", "todo", filePath.path);

        try {
          result = yaml.parse(data, {
            schema: "core",
            merge: true,
            maxAliasCount: 1000,
          });
        } catch (e) {
          logger.warn(
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
      } else if (filePath.extension == "json") {
        logger.debug("[homebrew:%s] Found JSON file %s", "todo", filePath.path);

        try {
          result = JSON.parse(data);
        } catch (e) {
          logger.warn(
            "[homebrew-collection:%s] Failed to parse JSON file %s. Errors: %o",
            "todo",
            filePath.path,
            e,
          );
          return {
            kind: "content",
            data: {
              success: false,
              error: new Error(
                `Failed to parse JSON file ${filePath.path}: ${e}`,
              ),
            },
          };
        }
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
        // TODO: handle the possibility of non-source data?

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
    hash: Uint8Array<ArrayBuffer>,
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

    if (
      existing != null &&
      hash.every((byte, index) => existing.hash[index] === byte)
    ) {
      logger.debug(
        "[content-indexer] File %s has not changed. Skipping re-index.",
        path,
      );
      return; // No change in content, skip re-indexing
    }

    const filePath = new FilePath(path);
    const value = this.#parse(filePath, data, frontmatter);
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

export interface IContentManager {
  onUpdateRoot(
    callback: (root: string, content: Content[] | null) => unknown,
  ): void;
  addRoot(path: string): void;
  removeRoot(path: string): void;
  getContent(path: string): Content | undefined;
  addContent(content: Content): void;
  deleteContent(path: string): boolean;
  renameContent(oldPath: string, newPath: string): boolean;
  getRoots(): ReadonlySet<string>;
  valuesUnderPath(path: string): Iterable<Content>;
}

export class MetarootContentManager implements IContentManager {
  private metaRoot: string | null = null;

  constructor(private readonly delegate: IContentManager) {}

  onUpdateRoot(
    callback: (root: string, content: Content[] | null) => unknown,
  ): void {
    this.delegate.onUpdateRoot(callback);
  }

  /** Tests if a given path is in the meta root. */
  isInMetaRoot(path: string): boolean {
    return this.metaRoot ? childOfPath(this.metaRoot, path) : false;
  }

  setMetaRoot(path: string | null): void {
    if (this.metaRoot && this.metaRoot != path) {
      // The old metaroot is no longer valid. Remove all roots that came from it.
      logger.debug(
        "[content-manager] Meta root changed from %s to %s. Clearing old roots.",
        this.metaRoot,
        path,
      );
      for (const root of this.delegate.getRoots()) {
        if (childOfPath(this.metaRoot, root)) {
          logger.debug(
            "[content-manager] Removing root %s due to meta root change.",
            root,
          );
          this.delegate.removeRoot(root);
        }
      }
    } else if (this.metaRoot === path) {
      logger.debug(
        "[content-manager] Meta root is already %s. Ignoring.",
        path,
      );
      return;
    }

    this.metaRoot = path;

    if (this.metaRoot) {
      logger.debug(
        "[content-manager] Meta root set to %s. Updating roots.",
        this.metaRoot,
      );
      for (const { path: contentPath } of this.delegate.valuesUnderPath(
        this.metaRoot,
      )) {
        const metaParent = findTopLevelParentPath(this.metaRoot, contentPath);
        if (metaParent) this.delegate.addRoot(metaParent);
      }
    }
  }

  addRoot(path: string): void {
    if (this.metaRoot && childOfPath(this.metaRoot, path)) {
      logger.debug(
        "[content-manager] Ignoring addRoot %s because it is within the meta root %s.",
        path,
        this.metaRoot,
      );
      return; // Ignore roots outside the meta root
    }
    this.delegate.addRoot(path);
  }

  removeRoot(path: string): void {
    if (this.metaRoot && childOfPath(this.metaRoot, path)) {
      logger.debug(
        "[content-manager] Ignoring removeRoot %s because it is within the meta root %s.",
        path,
        this.metaRoot,
      );
      return; // Ignore roots outside the meta root
    }
    this.delegate.removeRoot(path);
  }

  getContent(path: string): Content | undefined {
    return this.delegate.getContent(path);
  }

  addContent(content: Content): void {
    // We need to check if this represents a new root under the metaroot
    const topLevel = this.metaRoot
      ? findTopLevelParentPath(this.metaRoot, content.path)
      : undefined;
    if (topLevel) {
      this.delegate.addRoot(topLevel);
    }
    return this.delegate.addContent(content);
  }

  deleteContent(path: string): boolean {
    return this.delegate.deleteContent(path);
  }

  renameContent(oldPath: string, newPath: string): boolean {
    const topLevelOld = this.metaRoot
      ? findTopLevelParentPath(this.metaRoot, oldPath)
      : undefined;
    const topLevelNew = this.metaRoot
      ? findTopLevelParentPath(this.metaRoot, newPath)
      : undefined;

    let changed = false;
    if (topLevelOld === oldPath) {
      // If the old path is a top-level root, we need to remove it
      this.delegate.removeRoot(topLevelOld);
      changed = true;
    }

    if (topLevelNew === newPath) {
      // If the new path is a top-level root, we need to add it
      this.delegate.addRoot(topLevelNew);
      changed = true;
    }

    if (this.delegate.renameContent(oldPath, newPath)) {
      changed = true;
    }

    return changed;
  }
  getRoots(): ReadonlySet<string> {
    return this.delegate.getRoots();
  }
  valuesUnderPath(path: string): Iterable<Content> {
    return this.delegate.valuesUnderPath(path);
  }
}

export class ContentManager implements IContentManager {
  private contentIndex: ContentIndex;
  private roots: Set<string> = new Set();
  private updateRootCallback: (
    root: string,
    content: Content[] | null,
  ) => unknown = () => {};

  constructor() {
    this.contentIndex = new Map();
  }

  onUpdateRoot(
    callback: (root: string, content: Content[] | null) => unknown,
  ): void {
    this.updateRootCallback = callback;
  }

  getRoots(): ReadonlySet<string> {
    return this.roots;
  }

  addRoot(path: string): void {
    const existingRoot = this.rootForPath(path);
    if (existingRoot === path) {
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
    if (this.roots.delete(path)) {
      this.updateRootCallback(path, null);
    }
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
      logger.debug(
        "[content-manager] Renaming content from %s to %s",
        oldPath,
        newPath,
      );
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
      if (key == path || childOfPath(path, key)) {
        yield content;
      }
    }
  }

  rootForPath(path: string): string | undefined {
    for (const root of this.roots) {
      if (root == path || childOfPath(root, path)) {
        return root;
      }
    }
    return undefined;
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

function isEntryType(type: string | undefined | null): type is EntryTypes {
  return ENTRY_TYPES.includes(type as EntryTypes);
}

const parentForCollection: Record<CollectionTypes, CollectionTypes[]> = {
  oracle_collection: ["oracle_collection", "root"],
  move_category: ["move_category", "root"],
  asset_collection: ["asset_collection", "root"],
  root: ["root"],
};

export type CollectionAnnotations = {
  collectionType: CollectionTypes | null;
};

export abstract class BaseFileProblem {
  abstract readonly _tag: string;
  constructor(public readonly message: string) {}
}

export class WrongDataswornVersionProblem extends BaseFileProblem {
  _tag = "WrongDataswornVersionProblem";
}

export class SchemaValidationFailedProblem extends BaseFileProblem {
  _tag = "SchemaValidationFailedProblem";
  errors: ErrorObject[];

  static is(problem: FileProblem): problem is SchemaValidationFailedProblem {
    return problem._tag === "SchemaValidationFailedProblem";
  }

  constructor(message: string, error: SchemaValidationFailedError) {
    super(message);
    this.errors = error.errors;
  }
}

export class ErrorProblem extends BaseFileProblem {
  _tag = "ErrorProblem";
  constructor(public readonly error: Error) {
    super(error.message);
  }
}

export type FileProblem =
  | SchemaValidationFailedProblem
  | ErrorProblem
  | WrongDataswornVersionProblem;

export type PackageResults = {
  files: Map<string, Either<FileProblem, DataswornSource.RulesPackage>>;
  result: Datasworn.RulesPackage | null;
};

export class PackageBuilder {
  labels: NodeMap<Content["value"], CollectionAnnotations, NodeLabel>;

  #packages: [string, Either<Error, DataswornSource.RulesPackage>][] = [];
  #files: Map<string, Either<FileProblem, DataswornSource.RulesPackage>> =
    new Map();
  #result: Datasworn.RulesPackage | null = null;

  /** Builds a package from the given content, by loading it into a NodeBuilder. */
  static fromContent(
    root: string,
    content: Iterable<Content>,
    packageId?: string,
  ): PackageResults {
    const builder = new NodeBuilder<Content["value"], CollectionAnnotations>(
      () => ({ collectionType: null }),
      { collectionType: "root" },
    );

    for (const item of content) {
      logger.debug(
        "[PackageBuilder] [root:%s] Adding item at path: %s",
        root,
        item.path,
      );
      builder.addLeafNodeAtPath(item.path, item.value, true);
    }

    const rootNode = builder.getNode(root);
    if (rootNode == null) {
      return {
        result: null,
        files: new Map([]),
      };
    }

    switch (rootNode.type) {
      case "group":
        return new PackageBuilder(
          rootNode,
          packageId ?? sanitizeNameForId(rootNode.name),
        ).compile();
      case "leaf":
        if (rootNode.data.kind === "package") {
          try {
            return {
              // TODO: we need to validate the package here.
              result: RulesPackageBuilder.schemaValidator(rootNode.data.package)
                ? rootNode.data.package
                : null,
              // TODO: maybe it should go in the files?
              files: new Map(),
            };
          } catch (e) {
            let packageProblem: FileProblem;
            if (e instanceof SchemaValidationFailedError) {
              if (
                e.errors.find(
                  (err) =>
                    err.instancePath == "/datasworn_version" &&
                    err.keyword == "const",
                )
              ) {
                packageProblem = new WrongDataswornVersionProblem(
                  `Datasworn schema version ${rootNode.data.package.datasworn_version} does not match expected version ${PLUGIN_DATASWORN_VERSION}`,
                );
              } else {
                packageProblem = new SchemaValidationFailedProblem(
                  `Datasworn schema validation failed`,
                  e,
                );
              }
            } else {
              packageProblem = new ErrorProblem(
                e instanceof Error ? e : new Error(`Unknown error ${e}`),
              );
            }
            return {
              result: null,
              files: new Map([[root, Left.create(packageProblem)]]),
            };
          }
        }
        throw new Error(`Root path "${root}" is a leaf node, not a group.`);
    }
  }

  constructor(
    private root: DataGroup<Content["value"], CollectionAnnotations>,
    public readonly packageId: string,
  ) {
    this.labels = labelCollections(root);
    this.build();
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
      _id: this.packageId,
    };

    return (this.#packages = this.root.children.flatMap((child) =>
      this.buildTopCollection(child, packageData, source),
    ));
  }

  compile(): PackageResults {
    if (this.#packages.length === 0) {
      logger.debug("[package-builder:] No packages to compile.");
      return { result: null, files: new Map() };
    }

    const dataswornCompiler = new RulesPackageBuilder(
      this.packageId,
      rootLogger.getLogger("builder"),
    );

    for (const [filePath, source] of this.#packages) {
      if (source.isLeft()) {
        this.#files.set(filePath, Left.create(new ErrorProblem(source.error)));
        logger.error(
          "[package-builder:%s] Error building file %s: %o",
          this.packageId,
          filePath,
          source.error,
        );
      } else {
        logger.debug(
          "File path: %s -> Source: %o",
          filePath,
          structuredClone(source.value),
        );

        // Note that the datasworn compiler makes destructive changes to the data
        // passed in. As a result, we need to clone the source value to preserve
        // the original data.
        dataswornCompiler.addFiles({
          name: filePath,
          data: structuredClone(source.value),
        });

        const validationError = dataswornCompiler.errors.get(filePath);
        if (validationError) {
          this.#files.set(
            filePath,
            Left.create(
              validationError instanceof SchemaValidationFailedError
                ? new SchemaValidationFailedProblem(
                    "Failed Datasworn Source schema validation",
                    validationError,
                  )
                : new ErrorProblem(
                    validationError instanceof Error
                      ? validationError
                      : new Error(`unexpected error: ${validationError}`),
                  ),
            ),
          );
          logger.error(
            "[package-builder:%s] Error validating file %s: %o",
            this.packageId,
            filePath,
            validationError,
          );
          // Remove the file from the compiler, since it is invalid.
          dataswornCompiler.files.delete(filePath);
          dataswornCompiler.errors.delete(filePath);
        } else {
          this.#files.set(filePath, Right.create(source.value));
        }
      }
    }

    logger.debug("Starting build");
    try {
      dataswornCompiler.build();
      const resultData = structuredClone(dataswornCompiler.toJSON());

      if (
        (resultData as Datasworn.Expansion).ruleset ===
        WILDCARD_TARGET_RULESET_PLACEHOLDER
      ) {
        (resultData as Datasworn.Expansion).ruleset = WILDCARD_TARGET_RULESET;
      }
      this.#result = resultData;
    } catch (e) {
      this.#result = null;
      this.#files.set(
        this.root.path,
        Left.create(
          new ErrorProblem(
            e instanceof Error ? e : new Error(`Error while compiling: ${e}`),
          ),
        ),
      );
    }

    return { result: this.#result, files: this.#files };
  }

  buildTopCollection(
    node: DataNode<Content["value"], CollectionAnnotations>,
    parent: DataswornSource.Expansion,
    parentSource: DataswornSource.SourceInfo,
  ): [string, Either<Error, DataswornSource.RulesPackage>][] {
    if (node.type !== "group") throw new Error("this can't happen");

    const groupTypeResult = this._getGroupType(node);
    if (groupTypeResult.isLeft()) {
      return [
        [node.path, groupTypeResult],
        ...reduceNodes<
          Content["value"],
          CollectionAnnotations,
          [string, Either<Error, DataswornSource.RulesPackage>][],
          [string, Either<Error, DataswornSource.RulesPackage>][]
        >(node, {
          reduceLeaf({ data, path }) {
            switch (data.kind) {
              case "content":
                return [
                  [
                    path,
                    Left.create(
                      data.data.success
                        ? new Error(
                            `Content parsed successfully, but collection type could not be determined.`,
                          )
                        : data.data.error,
                    ),
                  ],
                ];
              case "package":
                return [[path, Right.create(data.package)]];
              case "index":
                return [];
            }
          },
          reduceGroup(_group, { children }) {
            return children.flatMap(([, results]) => results);
          },
        }),
      ];
    }

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
          case "content": {
            const entryType = leaf.data.data.result?.type;
            if (isEntryType(entryType)) {
              return {
                kind: "leaf",
                leafType: entryType,
                allowableParents: [parentForEntry[entryType]],
              };
            }
            return { kind: "leaf", leafType: null, allowableParents: null };
          }
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

export function sanitizeNameForId(name: string): string {
  return name
    .replaceAll(/[0-9]/g, (digit) => numbers[Number.parseInt(digit)])
    .replaceAll(/[^a-z]+/gi, "_")
    .replaceAll(/^_|_$/g, "")
    .toLowerCase();
}
