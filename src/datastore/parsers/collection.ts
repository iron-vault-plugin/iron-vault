import { Datasworn, DataswornSource } from "@datasworn/core";
import { RulesPackageBuilder } from "@datasworn/core/dist/Builders";
import dataswornSourceSchema from "@datasworn/core/json/datasworn-source.schema.json" assert { type: "json" };
import dataswornSchema from "@datasworn/core/json/datasworn.schema.json" assert { type: "json" };
import Ajv from "ajv";
import addFormats from "ajv-formats";
import { rootLogger } from "logger";
import { App, TFile, TFolder, Vault } from "obsidian";

const logger = rootLogger.getLogger("homebrew-collection");

export class InvalidHomebrewError extends Error {}

import type { KeywordDefinition } from "ajv";
import {
  ContentIndexer,
  ContentManager,
  MetarootContentManager,
  PackageBuilder,
  sanitizeNameForId,
} from "datastore/loader/builder";
import {
  WILDCARD_TARGET_RULESET,
  WILDCARD_TARGET_RULESET_PLACEHOLDER,
} from "rules/ruleset";

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

export function buildCollection();

export async function indexCollectionRoot(
  app: App,
  rootFolder: TFolder,
  packageId?: string,
) {
  ensureRulesPackageBuilderInitialized();

  // If no package id is given, generate it from the folder name
  packageId ||= sanitizeNameForId(rootFolder.name);

  // Create content by traversing the folder structure and adding to
  // content indexer.
  logger.debug(
    "[homebrew-collection:%s] Indexing folder: %s",
    packageId,
    rootFolder.path,
  );
  const contentManager = new MetarootContentManager(new ContentManager());
  const contentIndexer = new ContentIndexer(contentManager);

  contentManager.addRoot(rootFolder.path);

  const promises: Promise<void>[] = [];
  async function index(file: TFile) {
    const content = await app.vault.cachedRead(file);
    contentIndexer.indexFile(
      file.path,
      file.stat.mtime,
      await ContentIndexer.computeHash(content),
      content,
      app.metadataCache.getFileCache(file)?.frontmatter,
    );
  }

  Vault.recurseChildren(rootFolder, (fileOrFolder) => {
    if (fileOrFolder instanceof TFile) {
      promises.push(index(fileOrFolder));
    }
  });

  await Promise.all(promises);

  const fileSources = PackageBuilder.fromContent(
    rootFolder.path,
    contentManager.valuesUnderPath(rootFolder.path),
  ).build();

  const dataswornCompiler = new RulesPackageBuilder(
    packageId,
    rootLogger.getLogger("builder"),
  );

  logger.setLevel("debug");

  for (const [filePath, source] of fileSources) {
    if (source.isLeft()) {
      logger.error(
        "[homebrew-collection:%s] Error building file %s: %o",
        packageId,
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
    }
  }

  logger.debug("Starting build");
  dataswornCompiler.build();

  if (dataswornCompiler.errors.size) {
    let msg = `Error loading homebrew files in ${rootFolder.path}. Errors:`;
    dataswornCompiler.errors.forEach((k, v) => {
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

  const resultData = dataswornCompiler.toJSON();

  if (
    (resultData as Datasworn.Expansion).ruleset ===
    WILDCARD_TARGET_RULESET_PLACEHOLDER
  ) {
    (resultData as Datasworn.Expansion).ruleset = WILDCARD_TARGET_RULESET;
  }

  return dataswornCompiler.toJSON();
}
