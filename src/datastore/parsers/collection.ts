import { Datasworn, DataswornSource } from "@datasworn/core";
import { RulesPackageBuilder } from "@datasworn/core/dist/Builders";
import dataswornSourceSchema from "@datasworn/core/json/datasworn-source.schema.json" assert { type: "json" };
import dataswornSchema from "@datasworn/core/json/datasworn.schema.json" assert { type: "json" };
import Ajv from "ajv";
import addFormats from "ajv-formats";
import { rootLogger } from "logger";
import { App, TAbstractFile, TFile, TFolder, Vault } from "obsidian";
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

type EntryTypes = 'oracle_rollable';
type CollectionTypes = 'oracle_collection' | 'root';

const parentForEntry: Record<EntryTypes, CollectionTypes> = {
  'oracle_rollable': 'oracle_collection',
};

const parentForCollection: Record<CollectionTypes, CollectionTypes[]> = {
  'oracle_collection': ['oracle_collection', 'root'],
  'root': []
}

export async function indexCollectionRoot(app: App, rootFolder: TFolder) {
  ensureRulesPackageBuilderInitialized();

  const packageId = rootFolder.name;

  const builder = new RulesPackageBuilder(
    packageId,
    rootLogger.getLogger("builder"),
  );

  const source: DataswornSource.SourceInfo = {
    authors: [],
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

  const fileResults = new Map<TFile, ParserReturn>();
  const folderLabeling = new Map<TFolder, Either<Error, "root" | "oracle_collection">>();

  folderLabeling.set(rootFolder, Right.create("root"));

  const queue: (TFile | TFolder)[] = [];

  for (const child of rootFolder.children) {
    if (child instanceof TFile) {
      // Root should have no children
      fileResults.set(child, {success: false, error: new Error(`root should have no files`)})
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
      folderLabeling.set(parent, Right.create(inferredTypeForParent));
      updateFolderParentLabels(parent, inferredTypeForParent);
    } else if (currentParentLabel.isRight() && currentParentLabel.value !== inferredTypeForParent) {
      folderLabeling.set(parent, Left.create(new Error(`incompatible types detected for folder: ${currentParentLabel.value} and ${inferredTypeForParent} (from ${file.path})`)));
    }
  }

  const updateFolderParentLabels = (folder: TFolder, folderType: CollectionTypes) => {
    const parent = folder.parent!;
    const currentParentLabel = folderLabeling.get(parent);
    const inferredTypesForParent = parentForCollection[folderType];

    if (currentParentLabel === undefined) {
      if (inferredTypesForParent.length == 1) {
      folderLabeling.set(parent, Right.create(inferredTypesForParent[0]));
      if (parent !== rootFolder)
        updateFolderParentLabels(parent, inferredTypesForParent[0]);
      }
    } else if (currentParentLabel.isRight() && !inferredTypesForParent.includes( currentParentLabel.value)) {
      folderLabeling.set(parent, Left.create(new Error(`incompatible types detected for folder:  ${currentParentLabel.value} and ${inferredTypesForParent} (from ${folder.path})`)))
    }
  }

  const constructQueue: TFolder[] = [];

  let nextFile;
  while ((nextFile = queue.shift()) != null) {
    if (nextFile instanceof TFolder) {
      // queue up files and then queue up folders
      queue.push(...nextFile.children.filter((file) => file instanceof TFile), ...nextFile.children.filter((file) => file instanceof TFolder));
      constructQueue.push(nextFile);
    } else if (nextFile instanceof TFile) {
      logger.debug(
        "[homebrew:%s] Inspecting file %s",
        packageId,
        nextFile.path,
      );
      // const id = `${baseName.replaceAll(/[^a-z0-9]+/gi, "_")}`.toLowerCase();

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
      }
    }
  }

  // Now, we can walk the tree based on the label
  constructQueue.reverse();
  for (const folder )


  const recurseFolder = async(
    folder: TFolder
  ) => {
    // TODO: check index file

    const childFolders: TFolder[] = [];

    for (const childFile of folder.children) {
      // We'll do folders second
      if (childFile instanceof TFolder) {
        childFolders.push()
        continue;
      } else if (!(childFile instanceof TFile)) {
        logger.warn(
          "Unexpected type for %o", childFile
        );
        continue;
      }


    }

    // Determine collection type
    const [firstEntry] = entries.values();
    const firstEntryType = firstEntry?.type;
    if (expectedType && firstEntryType != expectedType) {
      errors.push({
        path: folder.path,
        error: new Error(
          `expected to contain only entries of type ${expectedType}, but found ${firstEntryType}`,
        ),
      });
      return Left.create(errors);
    }
    const nonMatchingEntry = entries
      .values()
      .find(({ type }) => type !== firstEntryType);
    if (nonMatchingEntry != null) {
      errors.push({
        path: folder.path,
        error: new Error(
          `Expected folder to contain only a single type of entry but contains ${firstEntryType} and ${nonMatchingEntry.type}`,
        ),
      });
      return Left.create(errors);
    }

    // Create appropriate parent collection
    switch (firstEntryType) {
      case "oracle_rollable": {
        // TODO: support more than just table type?
        const newParent: DataswornSource.OracleCollection = {
          name: folder.name,
          type: "oracle_collection",
          oracle_type: "tables",
          _source: source,
          contents: Object.fromEntries(
            (
              entries as Map<string, DataswornSource.OracleRollableTable>
            ).entries(),
          ),
        };
        for (const folder of childFolders) {
        }
        break;
      }
    }
  };

  const processOracleFolder = (folder: TFolder, results: {file: TFile; data: DataswornSource.OracleRollableTable}[]):  => {

  }

  const promises: Promise<void>[] = [];
  Vault.recurseChildren(rootFolder, (file) => {
    if (file instanceof TFile) {
    }
  });

  await Promise.all(promises);

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
  return name.replaceAll(/[^a-z0-9]+/gi, "_").toLowerCase();
}
