import { Ruleset } from "rules/ruleset";
import { z } from "zod";

// const characterSchema = z.object({
//   name: z.string(),
//   momentum: z.number().optional(),
// });

export type Lens<A, B> = {
  get(source: A): B;
  update(source: A, newval: B): A;
};

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

export enum ImpactStatus {
  Unmarked = "⬡",
  Marked = "⬢",
}

export type CharacterLens<ValidatedCharacter> = {
  name: Lens<ValidatedCharacter, string>;
  momentum: Lens<ValidatedCharacter, number>;
  stats: Record<string, Lens<ValidatedCharacter, number>>;
  condition_meters: Record<string, Lens<ValidatedCharacter, number>>;
  assets: Lens<ValidatedCharacter, ForgedSheetAssetSchema[]>;
  impacts: Lens<ValidatedCharacter, Record<string, ImpactStatus>>;
};

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

export function prop<T, K extends string = string>(
  key: K,
): Lens<Record<string, unknown>, T> {
  return {
    get(source) {
      return source[key] as T;
    },
    update(source, newval) {
      if ((source[key] as T) === newval) return source;
      return { ...source, [key]: newval };
    },
  };
}

export type SchemaProp<
  Output,
  Def extends z.ZodTypeDef = z.ZodTypeDef,
  Input = Output,
> = {
  schema: z.ZodType<Output, Def, Input>;
  path: string;
};

export function lensForSchemaProp<
  Output,
  Def extends z.ZodTypeDef = z.ZodTypeDef,
  Input = Output,
>({
  schema,
  path,
}: SchemaProp<Output, Def, Input>): Lens<Record<string, unknown>, Output> {
  return {
    get(source) {
      return schema.parse(source[path]);
    },
    update(source, newval) {
      if (source[path] === newval) return source;
      // TODO: because we discard the value of parsed here, we will ignore any schema transformations
      // but we aren't handling those transformations in the get either... so...
      const parsed = schema.parse(newval);
      if (source[path] === parsed) return source;
      return { ...source, [path]: parsed };
    },
  };
}

function objectMap<K extends string, U, V>(
  obj: Record<K, U>,
  fn: (val: U, key: K) => V,
): Record<K, V> {
  return Object.fromEntries(
    Object.entries<U>(obj).map(([key, val]) => [key, fn(val, key as K)]),
  ) as Record<K, V>;
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

export function characterLens(ruleset: Ruleset): {
  validater: (data: unknown) => ValidatedCharacter;
  lens: CharacterLens<ValidatedCharacter>;
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
  function validater(data: unknown): ValidatedCharacter {
    const raw = schema.parse(data);
    return {
      raw,
      [ValidationTag]: ruleset.id,
    };
  }
  const lens: CharacterLens<ValidatedCharacter> = {
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
  return { validater, lens };
}
