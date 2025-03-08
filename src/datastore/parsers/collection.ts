import { Datasworn, DataswornSource } from "@datasworn/core";
import { RulesPackageBuilder } from "@datasworn/core/dist/Builders";
import dataswornSourceSchema from "@datasworn/core/json/datasworn-source.schema.json" assert { type: "json" };
import dataswornSchema from "@datasworn/core/json/datasworn.schema.json" assert { type: "json" };
import Ajv from "ajv";
import addFormats from "ajv-formats";
import { rootLogger } from "logger";
import { App, parseYaml, TFile, TFolder } from "obsidian";
import { parserForFrontmatter, ParserReturn } from "./markdown";

const logger = rootLogger.getLogger("homebrew-collection");

export class InvalidHomebrewError extends Error {}

import type { KeywordDefinition } from "ajv";
import {
  WILDCARD_TARGET_RULESET,
  WILDCARD_TARGET_RULESET_PLACEHOLDER,
} from "rules/ruleset";
import { Either, Left, Right } from "utils/either";

const rollableTableLike = {
  /* type annotation omitted because it won't place nice with anyOf */
  // type: 'array'

  items: {
    type: "object",
    properties: {
      min: {
        anyOf: [{ type: "integer" }, { type: "null" }],
      },
      max: {
        anyOf: [{ type: "integer" }, { type: "null" }],
      },
    },
  },
};

export const KEYWORDS: Record<string, Omit<KeywordDefinition, "keyword">> = {
  releaseStage: {
    // metaSchema: Keywords.releaseStage,
  },
  i18n: {
    type: "string",
    // metaSchema: Keywords.i18n,
  },
  remarks: {
    // metaSchema: Keywords.remarks,
  },
  rollable: {
    ...rollableTableLike,
    metaSchema: undefined, //Keywords.rollable,
  },
};

function ensureRulesPackageBuilderInitialized() {
  if (!RulesPackageBuilder.isInitialized) {
    // ref: https://github.com/rsek/datasworn/blob/v0.1.0/src/scripts/validation/ajv.ts
    const ajv = new Ajv({
      useDefaults: "empty",
      logger,
      strict: "log",
      strictSchema: "log",
      strictTypes: "log",
      validateFormats: false,
      verbose: true,
    });
    // ref: https://github.com/rsek/datasworn/blob/v0.1.0/src/scripts/validation/formats.ts
    ajv.addFormat("markdown", true);
    ajv.addFormat("dice_notation", true);
    addFormats(ajv);
    for (const keyword in KEYWORDS)
      ajv.addKeyword({ keyword, ...KEYWORDS[keyword] });
    ajv.addSchema(dataswornSchema, "Datasworn");
    ajv.addSchema(dataswornSourceSchema, "DataswornSource");
    RulesPackageBuilder.init({
      validator: (data): data is Datasworn.RulesPackage => {
        const result = ajv.validate("Datasworn", data);
        if (!result) {
          const shortErrors = ajv.errors?.map(
            ({ instancePath, parentSchema, message }) => ({
              parentSchema: parentSchema?.$id ?? parentSchema?.title,
              instancePath,
              message,
            }),
          );
          logger.error(
            "Failed datasworn schema validation: %o %o",
            shortErrors,
            data,
          );
          throw new InvalidHomebrewError(
            `Failed Datasworn schema validation. Errors: ${JSON.stringify(shortErrors, undefined, "\t")}`,
            {
              cause: ajv.errors,
            },
          );
        }
        return true;
      },
      sourceValidator: (data): data is DataswornSource.RulesPackage => {
        const result = ajv.validate("DataswornSource", data);
        if (!result) {
          const shortErrors = ajv.errors?.map(
            ({ instancePath, parentSchema, message }) => ({
              parentSchema: parentSchema?.$id ?? parentSchema?.title,
              instancePath,
              message,
            }),
          );
          throw new InvalidHomebrewError(
            `Failed Datasworn source schema validation. Errors: ${JSON.stringify(shortErrors, undefined, "\t")}`,
            {
              cause: ajv.errors,
            },
          );
        }
        return true;
      },
    });
  }
}

type EntryTypes = "oracle_rollable";
type CollectionTypes = "oracle_collection" | "root";

const parentForEntry: Record<EntryTypes, CollectionTypes> = {
  oracle_rollable: "oracle_collection",
};

const parentForCollection: Record<CollectionTypes, CollectionTypes[]> = {
  oracle_collection: ["oracle_collection", "root"],
  root: [],
};

export async function indexCollectionRoot(app: App, rootFolder: TFolder) {
  ensureRulesPackageBuilderInitialized();

  const packageId = sanitizeNameForId(rootFolder.name);

  const builder = new RulesPackageBuilder(
    packageId,
    rootLogger.getLogger("builder"),
  );

  const source: DataswornSource.SourceInfo = {
    authors: [{ name: "TODO" }],
    date: "0000-00-00",
    license: null,
    title: rootFolder.name,
    url: "https://example.com",
  };

  // TODO: allow creating full ruleset
  const packageRootObject: DataswornSource.Expansion = {
    _id: packageId,
    datasworn_version: "0.1.0",
    ruleset: WILDCARD_TARGET_RULESET_PLACEHOLDER,
    type: "expansion",
    ...source,
  };

  logger.setLevel("debug");

  const fileResults = new Map<TFile, ParserReturn>();
  const folderLabeling = new Map<
    TFolder,
    Either<Error, "root" | "oracle_collection">
  >();
  const folderAttributes = new Map<TFolder, Record<string, unknown>>();

  folderLabeling.set(rootFolder, Right.create("root"));

  const queue: (TFile | TFolder)[] = [];

  for (const child of rootFolder.children) {
    if (child instanceof TFile) {
      // Root should have no children
      fileResults.set(child, {
        success: false,
        error: new Error(`root should have no files`),
      });
    } else if (child instanceof TFolder) {
      queue.push(child);
    } else {
      logger.warn("Weird type on file %o", child);
    }
  }

  const updateFileParentLabel = (file: TFile, fileType: EntryTypes) => {
    const inferredTypeForParent = parentForEntry[fileType];
    const parent = file.parent!;
    const currentParentLabel = folderLabeling.get(parent);
    if (currentParentLabel === undefined) {
      logger.debug(
        "Setting parent %s to %s (based on child file %s of type %s)",
        parent.path,
        inferredTypeForParent,
        file.path,
        fileType,
      );
      folderLabeling.set(parent, Right.create(inferredTypeForParent));
      updateFolderParentLabels(parent, inferredTypeForParent);
    } else if (
      currentParentLabel.isRight() &&
      currentParentLabel.value !== inferredTypeForParent
    ) {
      folderLabeling.set(
        parent,
        Left.create(
          new Error(
            `incompatible types detected for folder: ${currentParentLabel.value} and ${inferredTypeForParent} (from ${file.path})`,
          ),
        ),
      );
    }
  };

  const updateFolderParentLabels = (
    folder: TFolder,
    folderType: CollectionTypes,
  ) => {
    const parent = folder.parent!;
    const currentParentLabel = folderLabeling.get(parent);
    let inferredTypesForParent = parentForCollection[folderType];

    if (currentParentLabel === undefined) {
      // It can't be the root, so let's filter that out.
      inferredTypesForParent = inferredTypesForParent.filter(
        (type) => type !== "root",
      );

      if (inferredTypesForParent.length == 1) {
        logger.debug(
          "Setting parent %s to %s (based on child folder %s of type %s)",
          parent.path,
          inferredTypesForParent[0],
          folder.path,
          folderType,
        );
        folderLabeling.set(parent, Right.create(inferredTypesForParent[0]));
        if (parent !== rootFolder)
          updateFolderParentLabels(parent, inferredTypesForParent[0]);
      }
    } else if (
      currentParentLabel.isRight() &&
      !inferredTypesForParent.includes(currentParentLabel.value)
    ) {
      folderLabeling.set(
        parent,
        Left.create(
          new Error(
            `incompatible types detected for folder:  ${currentParentLabel.value} and ${inferredTypesForParent} (from ${folder.path})`,
          ),
        ),
      );
    }
  };

  let nextFile: TFile | TFolder | undefined;
  while ((nextFile = queue.shift()) != null) {
    if (nextFile instanceof TFolder) {
      // queue up files and then queue up folders
      queue.push(
        ...nextFile.children.filter((file) => file instanceof TFile),
        ...nextFile.children.filter((file) => file instanceof TFolder),
      );
    } else if (nextFile instanceof TFile) {
      logger.debug(
        "[homebrew:%s] Inspecting file %s",
        packageId,
        nextFile.path,
      );

      if (nextFile.basename == "_index") {
        // This is an index file
        if (nextFile.extension == "md") {
          folderAttributes.set(
            nextFile.parent!,
            app.metadataCache.getFileCache(nextFile)?.frontmatter ?? {},
          );
        }
      }

      if (nextFile.extension == "md") {
        const parser = parserForFrontmatter(
          nextFile,
          app.metadataCache.getFileCache(nextFile),
        );
        if (parser) {
          const data = parser(
            await app.vault.cachedRead(nextFile),
            nextFile.basename,
            { type: "tbd" },
          );
          fileResults.set(nextFile, data);
          if (data.success) {
            logger.debug(
              "[homebrew:%s] Adding file %s %o",
              packageId,
              nextFile.path,
              data.result,
            );
            updateFileParentLabel(nextFile, data.result.type);
          } else {
            logger.error(
              "[homebrew-collection:%s] Failed to parse file %s. Errors: %o",
              packageId,
              nextFile.path,
              data.error,
            );
          }
        }
      } else if (nextFile.extension == "yml" || nextFile.extension == "yaml") {
        logger.debug(
          "[homebrew:%s] Found YAML file %s",
          packageId,
          nextFile.path,
        );
        const data = parseYaml(await app.vault.cachedRead(nextFile));
        builder.addFiles({ name: nextFile.path, data });
      }
    }
  }

  // Check for any errors in labeling
  for (const [folder, label] of folderLabeling.entries()) {
    if (label.isLeft()) {
      logger.error(
        "[homebrew-collection:%s] Error in folder %s: %o",
        packageId,
        folder.path,
        label.error,
      );
    }
  }

  // Check for any errors in the file results
  for (const [file, result] of fileResults.entries()) {
    if (!result.success) {
      logger.error(
        "[homebrew-collection:%s] Error in file %s: %o",
        packageId,
        file.path,
        result.error,
      );
    }
  }

  function buildOracleCollection(
    folder: TFolder,
  ): DataswornSource.OracleTablesCollection {
    logger.debug("Constructing oracle collection for folder %s", folder.path);

    // TODO: validate folder attributes -- probably on parsing up above?
    const attributes = folderAttributes.get(folder) ?? {};
    const collectionName = folder.name;
    const oracleCollection: DataswornSource.OracleTablesCollection = {
      oracle_type: "tables",
      type: "oracle_collection",
      name: (attributes.name as string) ?? collectionName,
      _source: source,
    };

    for (const child of folder.children) {
      if (child instanceof TFile) {
        const result = fileResults.get(child);
        if (result?.success) {
          if (result.result.type === "oracle_rollable") {
            const oracleId = sanitizeNameForId(child.basename);
            oracleCollection.contents ??= {};
            oracleCollection.contents[oracleId] = result.result;
          }
        }
      } else if (child instanceof TFolder) {
        // Check that folder is of type oracle_collection
        const label = folderLabeling.get(child);
        if (label?.getOrElse(() => "root") === "oracle_collection") {
          // TODO: probably theoretically need to check earlier on if sanitized name is unique
          const childId = sanitizeNameForId(child.name);
          const nestedCollection = buildOracleCollection(child);
          oracleCollection.collections ??= {};
          oracleCollection.collections[childId] = nestedCollection;
        }
      }
    }

    return oracleCollection;
  }

  // Now, we can walk the tree based on the labeling
  for (const child of rootFolder.children) {
    if (child instanceof TFile) {
      // Root should have no children
      continue;
    } else if (child instanceof TFolder) {
      const label = folderLabeling.get(child);
      if (label == null || label.isLeft()) {
        logger.error(
          "[homebrew-collection:%s] Error in folder %s: %o",
          packageId,
          child.path,
          label?.error,
        );
        continue;
      } else {
        switch (label.value) {
          case "root": {
            // This should be impossible.
            logger.error(
              "[homebrew-collection:%s] Error in folder %s: unexpected root folder",
              packageId,
              child.path,
            );
            break;
          }
          case "oracle_collection": {
            packageRootObject.oracles ||= {};
            packageRootObject.oracles[sanitizeNameForId(child.name)] =
              buildOracleCollection(child);
            break;
          }
        }
      }
    }
  }

  logger.debug("Package: %o", packageRootObject);

  builder.addFiles({ name: packageId, data: packageRootObject });

  logger.debug("Starting build");
  builder.build();

  if (builder.errors.size) {
    let msg = `Error loading homebrew files in ${rootFolder.path}. Errors:`;
    builder.errors.forEach((k, v) => {
      logger.error(
        "[homebrew-collection:%s] Couldn't build file %s: %o",
        packageId,
        k,
        v,
      );
      msg += `\n${k}: ${v}`;
    });
    throw new Error(msg);
  }

  const resultData = builder.toJSON();

  if (
    (resultData as Datasworn.Expansion).ruleset ===
    WILDCARD_TARGET_RULESET_PLACEHOLDER
  ) {
    (resultData as Datasworn.Expansion).ruleset = WILDCARD_TARGET_RULESET;
  }

  return builder.toJSON();
}

function sanitizeNameForId(name: string): string {
  // TODO: Numbers aren't allowed in the ID --> either need to give a warning, or sub out for text?
  return name.replaceAll(/[^a-z]+/gi, "_").toLowerCase();
}
