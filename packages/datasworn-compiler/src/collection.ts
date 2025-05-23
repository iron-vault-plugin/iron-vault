import type { ErrorObject, KeywordDefinition } from "ajv";
import Ajv from "ajv";
import addFormats from "ajv-formats";

import { Datasworn, DataswornSource } from "@datasworn/core";
import { RulesPackageBuilder } from "@datasworn/core/dist/Builders";
import dataswornSourceSchema from "@datasworn/core/json/datasworn-source.schema.json" assert { type: "json" };
import dataswornSchema from "@datasworn/core/json/datasworn.schema.json" assert { type: "json" };

import { logger } from "./logger";

export class InvalidHomebrewError extends Error {}

export class SchemaValidationFailedError extends InvalidHomebrewError {
  readonly _tag = "SchemaValidationFailedError";
  errors: ErrorObject[];
  constructor(message: string, errors: ErrorObject[], options?: ErrorOptions) {
    const formattedErrors = `\nErrors: ${JSON.stringify(errors, undefined, "\t")}`;
    super(message + formattedErrors, options);
    this.name = "SchemaValidationFailedError";
    this.errors = errors;
  }
}

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

export function ensureRulesPackageBuilderInitialized(): void {
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
          // const shortErrors = ajv.errors?.map(
          //   ({ instancePath, parentSchema, message }) => ({
          //     parentSchema: parentSchema?.$id ?? parentSchema?.title,
          //     instancePath,
          //     message,
          //   }),
          // );
          logger.error(
            "Failed datasworn schema validation: %o %o",
            ajv.errors,
            data,
          );
          throw new SchemaValidationFailedError(
            `Failed Datasworn schema validation`,
            ajv.errors ?? [],
          );
        }
        return true;
      },
      sourceValidator: (data): data is DataswornSource.RulesPackage => {
        const result = ajv.validate("DataswornSource", data);
        if (!result) {
          // const shortErrors = ajv.errors?.map(
          //   ({ instancePath, parentSchema, message }) => ({
          //     parentSchema: parentSchema?.$id ?? parentSchema?.title,
          //     instancePath,
          //     message,
          //   }),
          // );
          throw new SchemaValidationFailedError(
            `Failed Datasworn source schema validation`,
            ajv.errors ?? [],
          );
        }
        return true;
      },
    });
  }
}
