import { Move } from "@datasworn/core";
import { z } from "zod";
import { DataIndex } from "../datastore/data-index";
import {
  ConditionMeterDefinition,
  MeterCommon,
  Ruleset,
  SpecialTrackRule,
} from "../rules/ruleset";
import {
  ChallengeRanks,
  ProgressTrack,
  ProgressTrackSettings,
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
import {
  AssetError,
  assetMeters,
  assetWithDefnReader,
  defaultMarkedAbilitiesForAsset,
} from "./assets";

const ValidationTag: unique symbol = Symbol("validated ruleset");

export type ValidatedCharacter = {
  [ValidationTag]: string;
  raw: Record<string, unknown>;
};

export const characterAssetSchema = z.object({
  id: z.string(),
  marked_abilities: z.array(z.number().int().positive()).optional(),
  controls: z
    .record(z.union([z.string(), z.number().int(), z.boolean()]).nullable())
    .default({}),
  options: z
    .record(z.union([z.string(), z.number().int(), z.boolean()]).nullable())
    .default({}),
});

export type ForgedSheetAssetInput = z.input<typeof characterAssetSchema>;
export type ForgedSheetAssetSchema = z.output<typeof characterAssetSchema>;

export const baseForgedSchema = z
  .object({
    name: z.string(),
    momentum: z.number().int().gte(-10).lte(10),
    assets: z.array(characterAssetSchema).optional(),
  })
  .passthrough();

export type BaseForgedSchema = z.input<typeof baseForgedSchema>;

export enum ImpactStatus {
  Unmarked = "⬡",
  Marked = "⬢",
}

export interface CharacterLens {
  name: Lens<ValidatedCharacter, string>;
  momentum: Lens<ValidatedCharacter, number>;
  stats: Record<string, Lens<ValidatedCharacter, number>>;
  condition_meters: Record<string, Lens<ValidatedCharacter, number>>;
  assets: Lens<ValidatedCharacter, ForgedSheetAssetSchema[]>;
  impacts: Lens<ValidatedCharacter, Record<string, ImpactStatus>>;
  special_tracks: Record<string, Lens<ValidatedCharacter, ProgressTrack>>;
  ruleset: Ruleset;
}

function camelCase(str: string): string {
  return str
    .split(/[-_ ]+/g)
    .filter((part) => part.length > 0)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join("");
}

function legacyTrack(
  specialTrackRule: SpecialTrackRule,
  trackSettings: ProgressTrackSettings,
) {
  const formattedLabel = camelCase(specialTrackRule.label);
  const trackImageKey = `${formattedLabel}_TrackImage`;
  const progressKey = `${formattedLabel}_Progress`;
  const xpEarnedKey = `${formattedLabel}_XPEarned`;
  return {
    schema: {
      [trackImageKey]: z.string().optional(),
      [progressKey]: z.number().int().nonnegative(),
      [xpEarnedKey]: z.number().int().nonnegative(),
    },
    lens: {
      get(source) {
        return ProgressTrack.create_({
          difficulty: ChallengeRanks.Epic,
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
          [trackImageKey]: trackSettings.generateTrackImage(newval),
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
): Lens<Record<string, unknown>, Record<string, ImpactStatus>> {
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
        const val = source[dataKey];
        if (val === "⬢") {
          return ImpactStatus.Marked;
        } else {
          return ImpactStatus.Unmarked;
        }
      });
    },
    update(source, newval) {
      const original = this.get(source);
      const updates: [string, ImpactStatus][] = [];
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

export function countMarked(impacts: Record<string, ImpactStatus>): number {
  return Object.values(impacts).reduce(
    (count, impactStatus) =>
      count + (impactStatus === ImpactStatus.Marked ? 1 : 0),
    0,
  );
}

export function movesReader(
  charLens: CharacterLens,
  index: DataIndex,
): CharReader<Either<AssetError[], Move[]>> {
  const assetReader = assetWithDefnReader(charLens, index);
  return reader((source) => {
    return collectEither(assetReader.get(source)).map((assets) =>
      assets.flatMap(({ asset, defn }) => {
        const moveList: Move[] = [];
        const marked_abilities = asset.marked_abilities ?? [];
        for (const [idx, ability] of defn.abilities.entries()) {
          if (marked_abilities.includes(idx + 1)) {
            moveList.push(...Object.values(ability.moves ?? {}));
          }
        }
        return moveList;
      }),
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

export function meterLenses(
  charLens: CharacterLens,
  character: ValidatedCharacter,
  dataIndex: DataIndex,
): Record<
  string,
  { key: string; definition: ConditionMeterDefinition; lens: CharLens<number> }
> {
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
  const allAssetMeters = assetWithDefnReader(charLens, dataIndex)
    .get(character)
    .flatMap((assetResult) => {
      if (assetResult.isLeft()) {
        // TODO: should we handle this error differently? pass it up?
        console.warn("Missing asset: %o", assetResult.error);
        return [];
      } else {
        const { asset, defn } = assetResult.value;
        return assetMeters(
          charLens,
          defn,
          asset.marked_abilities ?? defaultMarkedAbilitiesForAsset(defn),
        );
      }
    })
    .map((val) => [val.key, val]);
  return {
    ...baseMeters,
    momentum: {
      key: "momentum",
      lens: charLens.momentum,
      definition: new ConditionMeterDefinition({
        label: "momentum",
        min: -6,
        max: 10,
        rollable: true,
      }),
    },
    ...Object.fromEntries(allAssetMeters),
  };
}

export function rollablesReader(
  charLens: CharacterLens,
): CharReader<{ key: string; value: number; definition: MeterCommon }[]> {
  return reader((character) => {
    return [
      ...Object.entries(charLens.condition_meters).map(([key, lens]) => ({
        key,
        value: lens.get(character),
        definition: charLens.ruleset.condition_meters[key],
      })),
      ...Object.entries(charLens.stats).map(([key, lens]) => ({
        key,
        value: lens.get(character),
        definition: charLens.ruleset.stats[key],
      })),
    ];
  });
}

export function characterLens(
  ruleset: Ruleset,
  trackSettings: ProgressTrackSettings,
): {
  validater: (data: unknown) => ValidatedCharacter;
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
    legacyTrack(rule, trackSettings),
  );
  const schema = baseForgedSchema.extend({
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
      lensForSchemaProp({ path: "name", schema: baseForgedSchema.shape.name }),
    ),
    momentum: v(
      lensForSchemaProp({
        path: "momentum",
        schema: baseForgedSchema.shape.momentum,
      }),
    ),
    assets: v(
      lensForSchemaProp({
        path: "assets",
        schema: baseForgedSchema.shape.assets.default([]),
      }),
    ),
    stats: objectMap(stats, (defn) => v(lensForSchemaProp(defn))),
    condition_meters: objectMap(condition_meters, (defn) =>
      v(lensForSchemaProp(defn)),
    ),
    impacts: v(createImpactLens(ruleset)),
    special_tracks: objectMap(specialTracks, ({ lens }) => v(lens)),
    ruleset,
  };

  function validater(data: unknown): ValidatedCharacter {
    const raw = schema.parse(data);
    return {
      raw,
      [ValidationTag]: ruleset.id,
    };
  }

  return { validater, lens };
}
export type CharLens<T> = Lens<ValidatedCharacter, T>;
export type CharReader<T> = Reader<ValidatedCharacter, T>;
export type CharWriter<T> = Writer<ValidatedCharacter, T>;
