import { type Datasworn } from "@datasworn/core";
import { rootLogger } from "logger";
import { z } from "zod";

export type ImpactCategory = Omit<Datasworn.ImpactCategory, "contents">;
export type ImpactRule = Datasworn.ImpactRule & { category: ImpactCategory };
export type SpecialTrackRule = Datasworn.SpecialTrackRule;

export function mergeRules(
  rules: Datasworn.Rules,
  expansions: Datasworn.RulesExpansion[],
): Datasworn.Rules {
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
  defaultValue?: number;
  rollable: boolean;
}

// function addMinMaxConstraint<T extends z.ZodType<U>, U extends {min: number; max: number}>(schema: T): z.ZodEffects<T, U, U> {
//   return schema.refine(({min, max}) => min < max, {
//     message: "min must be greater than max"
//   })
// }

const statDefinitionValidator = z
  .object({
    label: z.string(),
    min: z.number().int(),
    max: z.number().int().positive(),
    rollable: z.boolean().default(true),
    value: z.number().int().optional(),
  })
  .refine(({ min, max }) => min < max, {
    message: "min must be greater than max",
  })
  .refine(
    ({ min, max, value }) => value == null || (min <= value && value <= max),
    { message: "value must be between min and max" },
  );

export class StatDefinition implements Readonly<MeterCommon> {
  readonly kind = "stat" as const;
  readonly label: string;
  readonly min: number;
  readonly max: number;
  readonly rollable: boolean = true;

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
  readonly rollable: boolean;
  readonly defaultValue?: number;

  constructor(data: z.input<typeof statDefinitionValidator>) {
    const { label, min, max, rollable, value } =
      statDefinitionValidator.parse(data);
    this.label = label;
    this.min = min;
    this.max = max;
    this.rollable = rollable;
    this.defaultValue = value;
  }
}

const logger = rootLogger.getLogger("ruleset");

/** Used as the expansion ruleset for an expansion that can target any base set (or is unspecified). */
export const WILDCARD_TARGET_RULESET: string = "*";

export const WILDCARD_TARGET_RULESET_PLACEHOLDER: string =
  "highly_improbable_wildcard_placeholder_string";

function warnSameBaseRuleset(
  base: Datasworn.Ruleset,
  expansions: Datasworn.Expansion[],
) {
  const nonmatching = expansions.filter(
    (exp) => exp.ruleset != WILDCARD_TARGET_RULESET && exp.ruleset != base._id,
  );
  if (nonmatching.length > 0) {
    // TODO(@cwegrzyn): should this be an error?
    logger.warn(
      "Expansions included that do not target current base ruleset %s: %s",
      base._id,
      nonmatching.map((exp) => `${exp._id} targets ${exp.ruleset}`).join("; "),
    );
  }
}

export class Ruleset {
  readonly condition_meters: Record<string, ConditionMeterDefinition>;
  readonly stats: Record<string, StatDefinition>;
  readonly impacts: Record<string, ImpactRule>;
  readonly special_tracks: Record<string, SpecialTrackRule>;

  /** Value that will be associated with parsed character docs that are compatible with this ruleset. */
  readonly validationTag: string;

  /** All rules packages included. Base is always first. */
  readonly rulesPackageIds: string[];

  constructor(
    private readonly base: Datasworn.Ruleset,
    private readonly expansions: Datasworn.Expansion[],
  ) {
    warnSameBaseRuleset(base, expansions);
    const rules = mergeRules(
      base.rules,
      expansions.flatMap(({ rules }) => (rules != null ? [rules] : [])),
    );

    this.rulesPackageIds = [base._id, ...expansions.map((exp) => exp._id)];

    // TODO(@cwegrzyn): in some kind of perfect magical world maybe we compute this as a
    // hash of the contents or something else that would really mark the ruleset.
    this.validationTag = this.rulesPackageIds.join(";");

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
    this.impacts = Object.fromEntries(
      Object.entries(rules.impacts).flatMap(([_categoryKey, source]) => {
        const category: ImpactCategory = {
          label: source.label,
          description: source.description,
        };
        return Object.entries(source.contents).map(
          ([impactKey, impactDefn]) => [impactKey, { ...impactDefn, category }],
        );
      }),
    );
    this.special_tracks = rules.special_tracks;
  }

  merge(updates: Datasworn.Expansion): Ruleset {
    return new Ruleset(this.base, [...this.expansions, updates]);
  }

  get baseRulesetId(): string {
    return this.rulesPackageIds[0];
  }
}
