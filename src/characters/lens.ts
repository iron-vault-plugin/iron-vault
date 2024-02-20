import { Asset, Move } from "@datasworn/core";
import { z } from "zod";
import { DataIndex } from "../datastore/data-index";
import { Ruleset } from "../rules/ruleset";
import { Either, Left, Right, collectEither } from "../utils/either";
import {
  Lens,
  Reader,
  lensForSchemaProp,
  objectMap,
  reader,
  updating,
} from "../utils/lens";

const ValidationTag: unique symbol = Symbol("validated ruleset");

export type ValidatedCharacter = {
  [ValidationTag]: string;
  raw: Record<string, unknown>;
};

export const characterAssetSchema = z.object({
  id: z.string(),
  marked_abilities: z.array(z.number().int().positive()).optional(),
  condition_meter: z.number().int().nonnegative().optional(),
  marked_conditions: z.array(z.string()).optional(),
  marked_states: z.array(z.string()).optional(),
  inputs: z.record(z.any()).optional(),
});

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

export function countMarked(impacts: Record<string, ImpactStatus>): number {
  return Object.values(impacts).reduce(
    (count, impactStatus) =>
      count + (impactStatus === ImpactStatus.Marked ? 1 : 0),
    0,
  );
}

export class AssetError extends Error {}

export type CharLens<T> = Lens<ValidatedCharacter, T>;
export type CharReader<T> = Reader<ValidatedCharacter, T>;

export function assetWithDefnReader(
  charLens: CharacterLens,
  index: DataIndex,
): CharReader<
  Array<Either<AssetError, { asset: ForgedSheetAssetSchema; defn: Asset }>>
> {
  return reader((source) => {
    return charLens.assets.get(source).map((asset) => {
      const defn = index._assetIndex.get(asset.id);
      if (defn) {
        return Right.create({ asset, defn });
      } else {
        return Left.create(new AssetError(`missing asset with id ${asset.id}`));
      }
    });
  });
}

export function movesReader(
  charLens: CharacterLens,
  index: DataIndex,
): CharReader<Either<AssetError[], Move[]>> {
  const assetReader = assetWithDefnReader(charLens, index);
  return reader((source) => {
    return collectEither(assetReader.get(source)).map((assets) =>
      assets.flatMap(({ asset, defn }) => {
        const moveList = [];
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

export function characterLens(ruleset: Ruleset): {
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
  const schema = baseForgedSchema.extend({
    ...objectMap(stats, ({ schema }) => schema),
    ...objectMap(condition_meters, ({ schema }) => schema),
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
