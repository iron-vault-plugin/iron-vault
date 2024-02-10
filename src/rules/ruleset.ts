import { Rules, RulesExpansion } from "@datasworn/core";
import { z } from "zod";

export function mergeRules(rules: Rules, expansions: RulesExpansion[]): Rules {
  return {
    stats: Object.assign(rules.stats, ...expansions.map((exp) => exp.stats)),
    condition_meters: Object.assign(
      rules.condition_meters,
      ...expansions.map((exp) => exp.condition_meters),
    ),
    special_tracks: Object.assign(
      rules.special_tracks,
      ...expansions.map((exp) => exp.special_tracks),
    ),
    impacts: Object.assign(
      rules.impacts,
      ...expansions.map((exp) => exp.impacts),
    ),
    tags: Object.assign(rules.tags, ...expansions.map((exp) => exp.tags)),
  };
}

export interface MeterCommon {
  kind: "stat" | "condition_meter";
  label: string;
  min: number;
  max: number;
  default?: number;
}

// function addMinMaxConstraint<T extends z.ZodType<U>, U extends {min: number; max: number}>(schema: T): z.ZodEffects<T, U, U> {
//   return schema.refine(({min, max}) => min < max, {
//     message: "min must be greater than max"
//   })
// }

const statDefinitionValidator = z
  .object({
    label: z.string(),
    min: z.number().int().nonnegative(),
    max: z.number().int().positive(),
  })
  .refine(({ min, max }) => min < max, {
    message: "min must be greater than max",
  });

export class StatDefinition implements Readonly<MeterCommon> {
  readonly kind = "stat" as const;
  readonly label: string;
  readonly min: number;
  readonly max: number;

  constructor(data: z.input<typeof statDefinitionValidator>) {
    const { label, min, max } = statDefinitionValidator.parse(data);
    this.label = label;
    this.min = min;
    this.max = max;
  }
}

export class ConditionMeterDefinition implements Readonly<MeterCommon> {
  readonly kind = "condition_meter" as const;
  readonly label: string;
  readonly min: number;
  readonly max: number;

  constructor(data: z.input<typeof statDefinitionValidator>) {
    const { label, min, max } = statDefinitionValidator.parse(data);
    this.label = label;
    this.min = min;
    this.max = max;
  }
}

export class Ruleset {
  readonly condition_meters: Record<string, ConditionMeterDefinition>;
  readonly stats: Record<string, StatDefinition>;
  // TODO: impacts

  constructor(rules: Rules) {
    this.condition_meters = Object.fromEntries(
      Object.entries(rules.condition_meters).map(([key, meter]) => [
        key,
        new ConditionMeterDefinition(meter),
      ]),
    );
    this.stats = Object.fromEntries(
      Object.entries(rules.stats).map(([key, stat]) => [
        key,
        new StatDefinition({ ...stat, min: 0, max: 5 }),
      ]),
    );
  }
}
