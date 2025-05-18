import schema from "@datasworn/core/json/datasworn.schema.json" with { type: "json" };

export const COMPILER_DATASWORN_VERSION: string =
  schema.definitions.Ruleset.properties.datasworn_version.const;
