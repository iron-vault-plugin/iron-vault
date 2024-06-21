import { type Datasworn } from "@datasworn/core";
import { zodResultToEither } from "utils/zodutils";
import { z } from "zod";
import {
  ConditionMeterDefinition,
  MeterCommon,
  Ruleset,
  SpecialTrackRule,
} from "../rules/ruleset";
import {
  ChallengeRanks,
  ProgressTrack,
  legacyTrackXpEarned,
} from "../tracks/progress";
import { Either, collectEither } from "../utils/either";
import {
  Lens,
  Reader,
  Writer,
  lensForSchemaProp,
  objectMap,
  reader,
  updating,
} from "../utils/lens";
import { IDataContext } from "./action-context";
import { AssetError, assetMeters, assetWithDefnReader } from "./assets";

const ValidationTag: unique symbol = Symbol("validated ruleset");

export type ValidatedCharacter = {
  [ValidationTag]: string;
  raw: Record<string, unknown>;
};

export const characterAssetSchema = z.object({
  id: z.string(),
  abilities: z.array(z.boolean()),
  controls: z
    .record(z.union([z.string(), z.number().int(), z.boolean()]).nullable())
    .default({}),
  options: z
    .record(z.union([z.string(), z.number().int(), z.boolean()]).nullable())
    .default({}),
});

export type IronVaultSheetAssetInput = z.input<typeof characterAssetSchema>;
export type IronVaultSheetAssetSchema = z.output<typeof characterAssetSchema>;

export const baseIronVaultSchema = z
  .object({
    name: z.string(),
    callsign: z.string().optional(),
    pronouns: z.string().optional(),
    description: z.string().optional(),
    xp_spent: z.number().int().nonnegative().default(0),
    momentum: z.number().int().gte(-10).lte(10),
    assets: z.array(characterAssetSchema).optional(),
    initiative: z.boolean().optional(),
  })
  .passthrough();

export type BaseIronVaultSchema = z.input<typeof baseIronVaultSchema>;

// export enum ImpactStatus {
//   Unmarked = "marked",
//   Marked = "un",
// }

export interface CharacterLens {
  name: Lens<ValidatedCharacter, string>;
  callsign: Lens<ValidatedCharacter, string | undefined>;
  pronouns: Lens<ValidatedCharacter, string | undefined>;
  description: Lens<ValidatedCharacter, string | undefined>;
  xp_spent: Lens<ValidatedCharacter, number>;
  momentum: Lens<ValidatedCharacter, number>;
  stats: Record<string, Lens<ValidatedCharacter, number>>;
  condition_meters: Record<string, Lens<ValidatedCharacter, number>>;
  assets: Lens<ValidatedCharacter, IronVaultSheetAssetSchema[]>;
  impacts: Lens<ValidatedCharacter, Record<string, boolean>>;
  special_tracks: Record<string, Lens<ValidatedCharacter, ProgressTrack>>;
  initiative: Lens<ValidatedCharacter, boolean | undefined>;
  ruleset: Ruleset;
}

function camelCase(str: string): string {
  return str
    .split(/[-_ ]+/g)
    .filter((part) => part.length > 0)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join("");
}

function legacyTrack(specialTrackRule: SpecialTrackRule) {
  const formattedLabel = camelCase(specialTrackRule.label);
  const progressKey = `${formattedLabel}_Progress`;
  const xpEarnedKey = `${formattedLabel}_XPEarned`;
  return {
    schema: {
      [progressKey]: z.number().int().nonnegative(),
      [xpEarnedKey]: z.number().int().nonnegative(),
    },
    lens: {
      get(source) {
        return ProgressTrack.create_({
          rank: ChallengeRanks.Epic,
          // SAFE: a validated character will satisfy the above schema
          progress: source[progressKey] as number,
          complete: false,
          unbounded: true,
        });
      },
      update(source, newval) {
        const orig = this.get(source);

        if (orig.progress === newval.progress) return source;
        if (legacyTrackXpEarned(orig) !== source[xpEarnedKey]) {
          throw new Error(
            `unexpected XP amount ${source[xpEarnedKey]} for track with ${source[progressKey]} progress (expected: ${legacyTrackXpEarned(orig)})`,
          );
        }
        return {
          ...source,
          [progressKey]: newval.progress,
          [xpEarnedKey]: legacyTrackXpEarned(newval),
        };
      },
    } satisfies Lens<Record<string, unknown>, ProgressTrack>,
  };
}

export function validatedAgainst(
  ruleset: Ruleset,
  data: ValidatedCharacter,
): boolean {
  return data[ValidationTag] === ruleset.id;
}

export function validated(
  ruleset: Ruleset,
): <T, U extends Record<string, unknown>>(
  lens: Lens<U, T>,
) => Lens<ValidatedCharacter, T> {
  return <T, U>(lens: Lens<U, T>): Lens<ValidatedCharacter, T> => ({
    get(a) {
      if (a[ValidationTag] !== ruleset.id) {
        throw new Error(
          `expecting validation tag of ${ruleset.id}; found ${a[ValidationTag]}`,
        );
      }
      // TODO: better way to deal with this (e.g., some way to verify that the ruleset specifies this?)
      return lens.get(a.raw as U);
    },
    update(a, b) {
      if (a[ValidationTag] !== ruleset.id) {
        throw new Error(
          `expecting validation tag of ${ruleset.id}; found ${a[ValidationTag]}`,
        );
      }
      const updated = lens.update(a.raw as U, b) as ValidatedCharacter;
      // If the lens does not change the raw value, return source as is.
      if (a.raw === updated) return a;
      // TODO: theoretically, could the return value fall out of validation? yes, in broken code.
      return { [ValidationTag]: ruleset.id, raw: updated };
    },
  });
}

function createImpactLens(
  ruleset: Ruleset,
): Lens<Record<string, unknown>, Record<string, boolean>> {
  // function createImpactLens(data: Record<string, unknown>, ruleset: Ruleset): Lens<Record<string, unknown>, Record<string, ImpactStatus>> {
  // const impactProps: Record<string, string> = {};
  // const dataKeys = Object.fromEntries(Object.keys(data).map((key) => [key.toLowerCase(), key]));
  // for (const key in ruleset.impacts) {
  //   impactProps[key] = dataKeys[key] ?? key;
  // }
  const impactProps: Record<string, string> = Object.fromEntries(
    Object.keys(ruleset.impacts).map((key) => [key, key]),
  );
  return {
    get(source) {
      return objectMap(impactProps, (dataKey) => {
        // TODO(@zkat): this needs validation.
        return !!source[dataKey];
      });
    },
    update(source, newval) {
      const original = this.get(source);
      const updates: [string, boolean][] = [];
      for (const key in newval) {
        if (!(key in impactProps)) {
          throw new Error(`unexpected key in impacts: ${key}`);
        }
      }
      for (const key in impactProps) {
        if (original[key] !== newval[key]) {
          updates.push([impactProps[key], newval[key]]);
        }
      }
      if (updates.length == 0) {
        return source;
      }
      return { ...source, ...Object.fromEntries(updates) };
    },
  };
}

// TODO: not all impacts are always active (mainly the vehicle ones)
export class MomentumTracker {
  public readonly momentum: number;
  public readonly maxMomentum: number;

  static readonly MIN_MOMENTUM: number = -6;
  static readonly MAX_MOMENTUM: number = 10;

  public constructor(
    momentum: number,
    public readonly impactsMarked: number,
  ) {
    this.maxMomentum = Math.max(0, 10 - impactsMarked);

    if (momentum < MomentumTracker.MIN_MOMENTUM) {
      this.momentum = MomentumTracker.MIN_MOMENTUM;
    } else if (momentum > this.maxMomentum) {
      this.momentum = this.maxMomentum;
    } else {
      this.momentum = momentum;
    }
  }

  get momentumReset(): number {
    return Math.max(0, 2 - this.impactsMarked);
  }

  updating(op: (mom: number) => number): MomentumTracker {
    return new MomentumTracker(op(this.momentum), this.impactsMarked);
  }

  take(amount: number): MomentumTracker {
    return this.updating((mom) => mom + amount);
  }

  suffer(amount: number): MomentumTracker {
    return this.updating((mom) => mom - amount);
  }

  reset(): MomentumTracker {
    return this.updating(() => this.momentumReset);
  }
}

export function momentumOps(characterLens: CharacterLens) {
  return {
    reset: updating(momentumTrackerLens(characterLens), (mom) => mom.reset()),
    take(amount: number) {
      return updating(momentumTrackerLens(characterLens), (mom) =>
        mom.take(amount),
      );
    },
    suffer(amount: number) {
      return updating(momentumTrackerLens(characterLens), (mom) =>
        mom.suffer(amount),
      );
    },
  };
}

function momentumTrackerLens(
  characterLens: CharacterLens,
): Lens<ValidatedCharacter, MomentumTracker> {
  return {
    get(character) {
      const markedImpacts = countMarked(characterLens.impacts.get(character));
      return new MomentumTracker(
        characterLens.momentum.get(character),
        markedImpacts,
      );
    },
    update(character, newval) {
      // TODO: should we validate that we have the same markedImpacts etc? for now, just trust
      // the transactional nature.
      return characterLens.momentum.update(character, newval.momentum);
    },
  };
}

export function momentumTrackerReader(
  characterLens: CharacterLens,
): CharReader<MomentumTracker> {
  return { get: momentumTrackerLens(characterLens).get };
}

export function countMarked(impacts: Record<string, boolean>): number {
  return Object.values(impacts).reduce(
    (count, impactStatus) => count + (impactStatus ? 1 : 0),
    0,
  );
}

export function movesReader(
  charLens: CharacterLens,
  dataContext: IDataContext,
): CharReader<
  Either<
    AssetError[],
    { move: Datasworn.EmbeddedMove; asset: Datasworn.Asset }[]
  >
> {
  const assetReader = assetWithDefnReader(charLens, dataContext);
  return reader((source) => {
    return collectEither(assetReader.get(source)).map((assets) =>
      assets.flatMap(({ asset: assetConfig, defn }) =>
        defn.abilities
          // Take only enabled abilities
          .filter((_ability, index) => assetConfig.abilities[index])
          // Gather moves
          .flatMap((ability) => Object.values(ability.moves ?? {}))
          .map((move) => ({ move, asset: defn })),
      ),
    );
  });
}

export function conditionMetersReader(
  charLens: CharacterLens,
): CharReader<
  { key: string; value: number; definition: ConditionMeterDefinition }[]
> {
  return reader((character) => {
    return [
      ...Object.entries(charLens.condition_meters).map(([key, lens]) => ({
        key,
        value: lens.get(character),
        definition: charLens.ruleset.condition_meters[key],
      })),
    ];
  });
}

export const MOMENTUM_METER_DEFINITION: MeterWithoutLens<ConditionMeterDefinition> =
  {
    key: "momentum",
    lens: undefined,
    value: undefined,
    definition: new ConditionMeterDefinition({
      label: "momentum",
      min: -6,
      max: 10,
      rollable: true,
    }),
  };

export function meterLenses(
  charLens: CharacterLens,
  character: ValidatedCharacter,
  dataContext: IDataContext,
): Record<string, MeterWithLens<ConditionMeterDefinition>> {
  const baseMeters = Object.fromEntries(
    Object.entries(charLens.condition_meters).map(([key, lens]) => [
      key,
      {
        key,
        lens,
        definition: charLens.ruleset.condition_meters[key],
      },
    ]),
  );
  const allAssetMeters = assetWithDefnReader(charLens, dataContext)
    .get(character)
    .flatMap((assetResult) => {
      if (assetResult.isLeft()) {
        // TODO: should we handle this error differently? pass it up?
        console.warn("Missing asset: %o", assetResult.error);
        return [];
      } else {
        const { asset, defn } = assetResult.value;
        return assetMeters(charLens, defn, asset.abilities);
      }
    })
    .map((val) => [val.key, val]);
  return {
    ...baseMeters,
    momentum: { ...MOMENTUM_METER_DEFINITION, lens: charLens.momentum },
    ...Object.fromEntries(allAssetMeters),
  };
}

export type KeyWithDefinition<T> = { key: string; definition: T };

export type WithCharLens<Base, T> = Base & { lens: CharLens<T>; value: T };
export type WithoutCharLens<Base> = Base & {
  lens: undefined;
  value: undefined;
};

export type MeterWithoutLens<T extends MeterCommon = MeterCommon> =
  WithoutCharLens<KeyWithDefinition<T>>;

export type MeterWithLens<T extends MeterCommon = MeterCommon> = WithCharLens<
  KeyWithDefinition<T>,
  number
>;

export function rollablesReader(
  charLens: CharacterLens,
  dataContext: IDataContext,
): CharReader<MeterWithLens[]> {
  return reader((character) => {
    return [
      ...Object.values(meterLenses(charLens, character, dataContext)).map(
        ({ key, definition, lens }) => ({
          key,
          definition,
          lens,
          value: lens.get(character),
        }),
      ),
      ...Object.entries(charLens.stats).map(([key, lens]) => ({
        key,
        definition: charLens.ruleset.stats[key],
        lens,
        value: lens.get(character),
      })),
    ];
  });
}

export type CharacterValidater = (
  data: unknown,
) => Either<z.ZodError, ValidatedCharacter>;

export function createValidCharacter(
  lens: CharacterLens,
  validater: CharacterValidater,
  name: string,
): ValidatedCharacter {
  const character: BaseIronVaultSchema = { name, momentum: 2 };
  const { ruleset } = lens;
  for (const [key, meter] of Object.entries(ruleset.condition_meters)) {
    character[key] = meter.defaultValue;
  }
  for (const [key, stat] of Object.entries(ruleset.stats)) {
    character[key] = stat.min;
  }
  for (const [, special_track] of Object.entries(ruleset.special_tracks)) {
    // TODO: since the lens update function expects the lens get function to work, we can't
    // currently use the lens to update this value. And that means duplicating this code.
    const formattedLabel = camelCase(special_track.label);
    const progressKey = `${formattedLabel}_Progress`;
    const xpEarnedKey = `${formattedLabel}_XPEarned`;
    character[progressKey] = 0;
    character[xpEarnedKey] = 0;
  }
  return validater(character).unwrap();
}

export function characterLens(ruleset: Ruleset): {
  validater: CharacterValidater;
  lens: CharacterLens;
} {
  const v = validated(ruleset);
  const stats = objectMap(ruleset.stats, (defn, key) => ({
    schema: z.number().int().gte(defn.min).lte(defn.max),
    path: key,
  }));
  const condition_meters = objectMap(ruleset.condition_meters, (defn, key) => ({
    schema: z.number().int().gte(defn.min).lte(defn.max),
    path: key,
  }));
  const specialTracks = objectMap(ruleset.special_tracks, (rule) =>
    legacyTrack(rule),
  );
  const schema = baseIronVaultSchema.extend({
    ...objectMap(stats, ({ schema }) => schema),
    ...objectMap(condition_meters, ({ schema }) => schema),
    ...Object.fromEntries(
      Object.values(specialTracks).flatMap(({ schema }) =>
        Object.entries(schema),
      ),
    ),
  });

  const lens: CharacterLens = {
    name: v(
      lensForSchemaProp({
        path: "name",
        schema: baseIronVaultSchema.shape.name,
      }),
    ),
    callsign: v(
      lensForSchemaProp({
        path: "callsign",
        schema: baseIronVaultSchema.shape.callsign,
      }),
    ),
    pronouns: v(
      lensForSchemaProp({
        path: "pronouns",
        schema: baseIronVaultSchema.shape.pronouns,
      }),
    ),
    description: v(
      lensForSchemaProp({
        path: "description",
        schema: baseIronVaultSchema.shape.description,
      }),
    ),
    xp_spent: v(
      lensForSchemaProp({
        path: "xp_spent",
        schema: baseIronVaultSchema.shape.xp_spent,
      }),
    ),
    momentum: v(
      lensForSchemaProp({
        path: "momentum",
        schema: baseIronVaultSchema.shape.momentum,
      }),
    ),
    assets: v(
      lensForSchemaProp({
        path: "assets",
        schema: baseIronVaultSchema.shape.assets.default([]),
      }),
    ),
    stats: objectMap(stats, (defn) => v(lensForSchemaProp(defn))),
    condition_meters: objectMap(condition_meters, (defn) =>
      v(lensForSchemaProp(defn)),
    ),
    impacts: v(createImpactLens(ruleset)),
    special_tracks: objectMap(specialTracks, ({ lens }) => v(lens)),
    initiative: v(
      lensForSchemaProp({
        path: "initiative",
        schema: baseIronVaultSchema.shape.initiative,
      }),
    ),
    ruleset,
  };

  function validater(data: unknown): Either<z.ZodError, ValidatedCharacter> {
    return zodResultToEither(schema.safeParse(data)).map((raw) => ({
      raw,
      [ValidationTag]: ruleset.id,
    }));
  }

  return { validater, lens };
}
export type CharLens<T> = Lens<ValidatedCharacter, T>;
export type CharReader<T> = Reader<ValidatedCharacter, T>;
export type CharWriter<T> = Writer<ValidatedCharacter, T>;
