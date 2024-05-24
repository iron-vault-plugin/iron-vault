import { z } from "zod";

const BurnDescriptorSchema = z.object({
  orig: z.number().int(),
  reset: z.number().int(),
});

export const ActionMoveDescriptionSchemaV1 = z.object({
  name: z.string(),
  action: z.number().int(),
  stat: z.string(),
  statVal: z.number().int(),
  adds: z.number().int(),
  challenge1: z.number().int(),
  challenge2: z.number().int(),
  burn: z.optional(BurnDescriptorSchema),
});

export type ActionMoveDescriptionV1 = z.output<
  typeof ActionMoveDescriptionSchemaV1
>;

const ActionMoveAddSchema = z.object({
  amount: z.number().int(),
  desc: z.string().optional(),
});

export type ActionMoveAdd = z.output<typeof ActionMoveAddSchema>;

export const ActionMoveDescriptionSchemaV2 =
  ActionMoveDescriptionSchemaV1.extend({
    id: z.string().optional(),
    adds: z.array(ActionMoveAddSchema).default([]),
  });

export type ActionMoveDescriptionV2 = z.output<
  typeof ActionMoveDescriptionSchemaV2
>;

export type ActionMoveDescription = ActionMoveDescriptionV2;

export type BurnDescriptor = z.infer<typeof BurnDescriptorSchema>;

const ProgressMoveDescriptionSchema = z.object({
  id: z.string().optional(),
  name: z.string(),
  progressTrack: z.string(),
  progressTicks: z.number(),
  challenge1: z.number().int(),
  challenge2: z.number().int(),
});

export type ProgressMoveDescription = z.infer<
  typeof ProgressMoveDescriptionSchema
>;

export const NoRollMoveDescriptionSchema = z.object({
  id: z.string().optional(),
  name: z.string(),
});

export type NoRollMoveDescription = z.infer<typeof NoRollMoveDescriptionSchema>;

export const AllMoveDescriptionSchemas = z.union([
  ActionMoveDescriptionSchemaV2,
  ProgressMoveDescriptionSchema,
  ActionMoveDescriptionSchemaV1,
  NoRollMoveDescriptionSchema,
]);

export type AllMoveDescriptions = z.infer<typeof AllMoveDescriptionSchemas>;

export const MoveDescriptionSchema = z.union([
  ActionMoveDescriptionSchemaV2,
  ProgressMoveDescriptionSchema,
  NoRollMoveDescriptionSchema,
]);

export type MoveDescription = z.infer<typeof MoveDescriptionSchema>;
export function moveIsAction(
  move: MoveDescription,
): move is ActionMoveDescription {
  return (move as ActionMoveDescription).action !== undefined;
}

export function moveIsProgress(
  move: MoveDescription,
): move is ProgressMoveDescription {
  return (move as ProgressMoveDescription).progressTrack !== undefined;
}
