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

export type ValidatedCharacter = Record<string, unknown> & {
  [ValidationTag]: string;
};

export const baseForgedSchema = z.object({
  name: z.string(),
  momentum: z.number().int(),
});

export type CharacterLens<ValidatedCharacter> = {
  name: Lens<ValidatedCharacter, string>;
  momentum: Lens<ValidatedCharacter, number>;
  stats: Record<string, Lens<ValidatedCharacter, number>>;
  condition_meters: Record<string, Lens<ValidatedCharacter, number>>;
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
      return lens.get(a as U);
    },
    update(a, b) {
      if (a[ValidationTag] !== ruleset.id) {
        throw new Error(
          `expecting validation tag of ${ruleset.id}; found ${a[ValidationTag]}`,
        );
      }
      let updated = lens.update(a as U, b) as ValidatedCharacter;
      // TODO: theoretically, could the return value fall out of validation? yes, in broken code.
      updated[ValidationTag] = ruleset.id;
      return updated;
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

export function validatedProp<T, K extends string = string>(
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

export type SchemaProp<U, Def extends z.ZodTypeDef = z.ZodTypeDef> = {
  schema: z.ZodType<U, Def>;
  path: string;
};

export function lensForSchemaProp<U, Def extends z.ZodTypeDef = z.ZodTypeDef>({
  schema,
  path,
}: SchemaProp<U, Def>): Lens<Record<string, unknown>, U> {
  return {
    get(source) {
      return source[path] as U;
    },
    update(source, newval) {
      const parsed = schema.parse(newval);
      if (source[path] === parsed) return source;
      return { ...source, [path]: newval };
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
    return { ...schema.parse(data), [ValidationTag]: ruleset.id };
  }
  const lens = {
    name: v(prop<string>("name")),
    momentum: v(prop<number>("momentum")),
    stats: objectMap(stats, (defn) => v(lensForSchemaProp(defn))),
    condition_meters: objectMap(condition_meters, (defn) =>
      v(lensForSchemaProp(defn)),
    ),
  };
  return { validater, lens };
}
