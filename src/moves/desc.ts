import { z } from "zod";

const BaseMoveDescriptionSchema = z.object({
  name: z.string(),
});

// type BaseMoveDescription = z.infer<typeof BaseMoveDescriptionSchema>;

const BurnSchema = z.object({
  orig: z.number().int(),
  reset: z.number().int(),
});

const ActionMoveDescriptionSchema = BaseMoveDescriptionSchema.extend({
  action: z.number().int(),
  stat: z.string(),
  statVal: z.number().int(),
  adds: z.number().int(),
  challenge1: z.number().int(),
  challenge2: z.number().int(),
  burn: z.optional(BurnSchema),
});

export type ActionMoveDescription = z.infer<typeof ActionMoveDescriptionSchema>;

const ProgressMoveDescriptionSchema = BaseMoveDescriptionSchema.extend({
  progressTrack: z.string(),
  progressTicks: z.number(),
  challenge1: z.number().int(),
  challenge2: z.number().int(),
});

export type ProgressMoveDescription = z.infer<
  typeof ProgressMoveDescriptionSchema
>;

export const MoveDescriptionSchema = z.union([
  ActionMoveDescriptionSchema,
  ProgressMoveDescriptionSchema,
]);

export type MoveDescription = z.infer<typeof MoveDescriptionSchema>;
export function moveIsAction(
  move: MoveDescription,
): move is ActionMoveDescription {
  return (move as ActionMoveDescription).action !== undefined;
}

export function moveIsProgress(
  move: MoveDescription,
): move is ActionMoveDescription {
  return (move as ProgressMoveDescription).progressTrack !== undefined;
}
