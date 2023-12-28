import { z } from "zod";

const coreRollSchema = z.object({
  /** numerical roll */
  roll: z.number().int().positive(),

  /** Id of oracle table */
  tableId: z.string(),

  /** Descriptive name of oracle table. */
  tableName: z.string(),

  /** The direct label of the entry, if one exists and is different than the result. */
  raw: z.string().optional(),

  /** Composite results */
  results: z.string().array(),
});

const baseRollSchema = coreRollSchema.extend({
  /** Sub rolls */
  subrolls: z.lazy(() => z.record(z.string(), z.array(rollSchema)).optional()),
});

type BaseRollSchema = z.infer<typeof coreRollSchema> & {
  subrolls?: Record<string, RollSchema[]>;
};

const simpleRollSchema = baseRollSchema.extend({ kind: z.literal("simple") });

type SimpleRollSchema = BaseRollSchema & { kind: "simple" };

export type MultiRollSchema = BaseRollSchema & { kind: "multi" };

export const multiRollSchema = baseRollSchema.extend({
  kind: z.literal("multi"),
});

export const templatedRollSchema = baseRollSchema.extend({
  kind: z.literal("templated"),
  templateString: z.string(),
});

export type TemplatedRollSchema = BaseRollSchema & {
  kind: "templated";
  templateString: string;
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

export const oracleSchema = z.object({
  roll: rollSchema,
  question: z.string().optional(),
});

export type OracleSchema = z.infer<typeof oracleSchema>;
