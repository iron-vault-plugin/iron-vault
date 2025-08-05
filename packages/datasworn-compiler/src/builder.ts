import { Datasworn, DataswornSource } from "@datasworn/core";
import { RulesPackageBuilder } from "@datasworn/core/dist/Builders";
import { ErrorObject } from "ajv";
import { produce } from "immer";
import * as yaml from "yaml";

import {
  MarkdownDataParser,
  ParserReturn,
  PARSERS_BY_TYPE,
  sanitizeNameForId,
  SchemaValidationFailedError,
} from "@ironvault/datasworn-compiler";

import Result from "true-myth/result";
import { COMPILER_DATASWORN_VERSION } from "./constants";
import { ContentManagerImpl, IContentManager } from "./content-store";
import { logger } from "./logger";
import {
  collectNodes,
  DataGroup,
  DataLeaf,
  DataNode,
  NodeMap,
  NodeTree,
  reduceNodes,
} from "./nodes";

/** Used as the expansion ruleset for an expansion that can target any base set (or is unspecified). */
export const WILDCARD_TARGET_RULESET: string = "*";

export const WILDCARD_TARGET_RULESET_PLACEHOLDER: string =
  "highly_improbable_wildcard_placeholder_string";

export type Content = {
  path: string;
  mtime: number;
  hash: Uint8Array;
  value:
    | { kind: "content"; data: ParserReturn }
    | { kind: "package"; package: DataswornSource.RulesPackage }
    | { kind: "index"; data: Record<string, unknown> };
};
export type ContentManager = ContentManagerImpl<Content>;

export type ContentIndex = Map<string, Content>;

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
  constructor(private manager: IContentManager<Content>) {}

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
    hash: Uint8Array,
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
  files: Map<string, Result<DataswornSource.RulesPackage, FileProblem>>;
  result: Datasworn.RulesPackage | null;
};

export class PackageBuilder {
  labels: NodeMap<Content["value"], CollectionAnnotations, NodeLabel>;

  #packages: [string, Result<DataswornSource.RulesPackage, Error>][] = [];
  #files: Map<string, Result<DataswornSource.RulesPackage, FileProblem>> =
    new Map();
  #result: Datasworn.RulesPackage | null = null;

  /** Builds a package from the given content, by loading it into a NodeBuilder. */
  static fromContent(
    root: string,
    content: Iterable<Content>,
    packageId?: string,
  ): PackageResults {
    const builder = new NodeTree<Content["value"], CollectionAnnotations>(
      () => ({ collectionType: null }),
      { collectionType: "root" },
    );

    for (const item of content) {
      logger.debug("Adding item at path:", item.path);
      // We copy the data at the point of entry here, because the Datasworn compiler tends
      // to mutate the data it receives. We both want to preserve the original data, and we
      // need to break object reuse by aliases, so we use JSON.parse/stringify.
      builder.addLeafNodeAtPath(
        item.path,
        JSON.parse(JSON.stringify(item.value)),
        true,
      );
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
            const data = rootNode.data.package;
            return {
              // TODO: we need to validate the package here.
              result: RulesPackageBuilder.schemaValidator(data) ? data : null,
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
                  `Datasworn schema version ${rootNode.data.package.datasworn_version} does not match expected version ${COMPILER_DATASWORN_VERSION}`,
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
              files: new Map([[root, Result.err(packageProblem)]]),
            };
          }
        }
        throw new Error(`Root path "${root}" is a leaf node, not a group.`);
    }
  }

  private constructor(
    private root: DataGroup<Content["value"], CollectionAnnotations>,
    public readonly packageId: string,
  ) {
    this.labels = labelCollections(root);
    this.build();
  }

  build(): [string, Result<DataswornSource.RulesPackage, Error>][] {
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
      logger.debug("No packages to compile.");
      return { result: null, files: new Map() };
    }

    const dataswornCompiler = new RulesPackageBuilder(this.packageId, logger);

    for (const [filePath, source] of this.#packages) {
      if (source.isErr) {
        this.#files.set(filePath, Result.err(new ErrorProblem(source.error)));
        logger.info("Error building file", filePath, ":", source.error);
      } else {
        logger.debug("File at path", filePath, ":", source.value);

        dataswornCompiler.addFiles({
          name: filePath,
          data: JSON.parse(JSON.stringify(source.value)), // Copy the data to avoid mutations
        });

        const validationError = dataswornCompiler.errors.get(filePath);
        if (validationError) {
          this.#files.set(
            filePath,
            Result.err(
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
          this.#files.set(filePath, Result.ok(source.value));
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
        Result.err(
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
  ): [string, Result<DataswornSource.RulesPackage, Error>][] {
    if (node.type === "leaf") {
      // If we have a leaf node, it should be a package file.
      if (node.data.kind === "package") {
        return [[node.path, Result.ok(node.data.package)]];
      }

      // Otherwise, we can't build a collection from a leaf node.
      return [
        [
          node.path,
          Result.err(
            new Error(
              `Expected a top-level YAML/JSON file or a folder, but got a '${node.data.kind}' file.`,
            ),
          ),
        ],
      ];
    }

    const walkChildren = () =>
      reduceNodes<
        Content["value"],
        CollectionAnnotations,
        [string, Result<DataswornSource.RulesPackage, Error>][],
        [string, Result<DataswornSource.RulesPackage, Error>][]
      >(node, {
        reduceLeaf({ data, path }) {
          switch (data.kind) {
            case "content":
              return [
                [
                  path,
                  Result.err(
                    data.data.success
                      ? new Error(
                          `Content parsed successfully, but collection type could not be determined.`,
                        )
                      : data.data.error,
                  ),
                ],
              ];
            case "package":
              return [[path, Result.ok(data.package)]];
            case "index":
              return [];
          }
        },
        reduceGroup(_group, { children }) {
          return children.flatMap(([, results]) => results);
        },
      });

    const groupTypeResult = this._getGroupType(node);
    if (groupTypeResult.isErr) {
      return [[node.path, groupTypeResult.cast()], ...walkChildren()];
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
      case null:
        // This is a group with no collection type, so let's just check the
        // children for package files
        return walkChildren();
      default:
        return [
          [
            node.path,
            Result.err(
              new Error("Unexpected collection type: " + collectionType),
            ),
          ],
        ];
    }
  }

  _getGroupType(
    node: DataNode<Content["value"], CollectionAnnotations>,
  ): Result<CollectionTypes | null, Error> {
    if (node.type === "leaf") {
      return Result.err(new Error("Expected a group node"));
    }

    // Now check the labels for this collection
    const label = this.labels.get(node);
    if (label == null || label.kind !== "collection") {
      return Result.err(new Error("Expected a collection node"));
    }

    const allowableTypes = label.allowableTypes;
    if (allowableTypes.isErr) {
      return allowableTypes.cast();
    }

    const collectionTypes = allowableTypes.value;
    if (collectionTypes == null) {
      return Result.ok(null);
    } else if (collectionTypes.length != 1) {
      return Result.err(
        new Error(
          `Expected exactly one collection type, but found ${collectionTypes}.`,
        ),
      );
    }
    return Result.ok(collectionTypes[0]);
  }

  checkType(
    node: DataGroup<Content["value"], CollectionAnnotations>,
    expected: CollectionTypes,
  ): Result<never, Error> | undefined {
    const groupType = this._getGroupType(node);
    if (groupType.isErr) {
      return groupType.cast();
    }
    if (groupType.value !== expected) {
      return Result.err(
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
  ): [string, Result<T, Error>][] {
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
      name: (attributes["name"] as string) ?? collectionName,
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
  ): [string, Result<T, Error>][] {
    // Index nodes are not leaves in the sense of content, so we skip them
    if (node.data.kind === "index") {
      return [];
    } else if (node.data.kind === "package") {
      // TODO: this as T implies that something is off. I think T should just be
      // DataswornSource.RulesPackage everywhere?
      return [[node.path, Result.ok(node.data.package as T)]];
    } else if (node.data.kind !== "content") {
      return [[node.path, Result.err(new Error("Expected content"))]];
    }
    if (!node.data.data.success) {
      return [[node.path, Result.err(node.data.data.error)]];
    }

    const attributes = node.data.data.result;
    if (!isDataswornSourceOfType(leafType, attributes)) {
      return [
        [
          node.path,
          Result.err(
            new Error(
              `Expected a ${leafType}, but found a ${attributes.type}.`,
            ),
          ),
        ],
      ];
    }

    return [
      [node.path, Result.ok(builder(sanitizeNameForId(node.name), attributes))],
    ];
  }

  buildMoveCategory<T>(
    node: DataGroup<Content["value"], CollectionAnnotations>,
    parentSource: DataswornSource.SourceInfo,
    builder: (key: string, collection: DataswornSource.MoveCategory) => T,
  ): [string, Result<T, Error>][] {
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
      name: (attributes["name"] as string) ?? collectionName,
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
  ): [string, Result<T, Error>][] {
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
      name: (attributes["name"] as string) ?? collectionName,
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
  private _getIndex(group: DataGroup<Content["value"], CollectionAnnotations>) {
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
  allowableTypes: Result<CollectionTypes[] | null, Error>; // The type of the collection node
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
            return leaf.data.data["type"] != null &&
              typeof leaf.data.data["type"] == "string" &&
              leaf.data.data["type"] in parentForCollection
              ? {
                  kind: "index",
                  allowableParents: [leaf.data.data["type"] as CollectionTypes],
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
        let hasTypedChildren = false;

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
          hasTypedChildren = true;
        }

        if (allowableTypes.size === 0) {
          // If we have no allowable types, we cannot have a collection.
          return {
            kind: "collection",
            allowableTypes: Result.err(
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
              allowableTypes: Result.err(
                new Error("Only the root can be of type 'root'."),
              ),
              allowableParents: null,
            };
          }
        }

        const allowableParents = hasTypedChildren
          ? [
              ...new Set(
                [...allowableTypes.values()].flatMap(
                  (type) => parentForCollection[type],
                ),
              ),
            ]
          : null;
        return {
          kind: "collection",
          allowableTypes: Result.ok(
            hasTypedChildren ? [...allowableTypes] : null,
          ),
          allowableParents,
        };
      },
    });

  return labels;
}
