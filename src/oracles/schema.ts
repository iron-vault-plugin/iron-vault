import { type OracleTable, type OracleTableRow } from "dataforged";
import { z } from "zod";

interface BaseRoll {
  kind: "simple" | "multi" | "templated";
  roll: number;
  table: OracleTable;
  row: OracleTableRow;
}
interface SimpleRoll extends BaseRoll {
  kind: "simple";
}
interface MultiRoll extends BaseRoll {
  kind: "multi";
  results: Roll[];
}
interface TemplatedRoll extends BaseRoll {
  kind: "templated";
  templateRolls: Map<string, Roll>;
}
export type Roll = SimpleRoll | MultiRoll | TemplatedRoll;

const baseRollSchema = z.object({
  /** numerical roll */
  roll: z.number().int().positive(),

  /** Id of oracle table */
  table: z.string(),

  /** Id of oracle table row */
  row: z.string(),
});

const simpleRollSchema = baseRollSchema.extend({ kind: z.literal("simple") });

type SimpleRollSchema = z.infer<typeof simpleRollSchema>;

export type MultiRollSchema = z.infer<typeof baseRollSchema> & {
  kind: "multi";
  results: RollSchema[];
};

export const multiRollSchema = baseRollSchema.extend({
  kind: z.literal("multi"),
  results: z.lazy(() => rollSchema.array()),
});

export const templatedRollSchema = baseRollSchema.extend({
  kind: z.literal("templated"),
  templateRolls: z.lazy(() => z.record(rollSchema)),
});

export type TemplatedRollSchema = z.infer<typeof baseRollSchema> & {
  kind: "templated";
  templateRolls: Record<string, RollSchema>;
};

export const rollSchema: z.ZodType<RollSchema> = z.discriminatedUnion("kind", [
  simpleRollSchema,
  multiRollSchema,
  templatedRollSchema,
]);

export type RollSchema =
  | SimpleRollSchema
  | MultiRollSchema
  | TemplatedRollSchema;
