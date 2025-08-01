import Result, { err, ok } from "true-myth/result";
import { z } from "zod";

export function zodResultToResult<Input, Output>(
  result: z.SafeParseReturnType<Input, Output>,
): Result<
  z.SafeParseSuccess<Output>["data"],
  z.SafeParseError<Input>["error"]
> {
  if (result.success) {
    return ok(result.data);
  } else {
    return err(result.error);
  }
}

export function normalizeKeys<
  T extends z.ZodRawShape,
  UnknownKeys extends z.UnknownKeysParam = z.UnknownKeysParam,
  Catchall extends z.ZodTypeAny = z.ZodTypeAny,
  Output = z.objectOutputType<T, Catchall, UnknownKeys>,
  Input = z.objectInputType<T, Catchall, UnknownKeys>,
>(
  schema: z.ZodObject<T, UnknownKeys, Catchall, Output, Input>,
): z.ZodPipeline<
  z.ZodEffects<
    z.ZodRecord<z.ZodString, z.ZodAny>,
    { [k: string]: unknown },
    Record<string, unknown>
  >,
  z.ZodObject<T, UnknownKeys, Catchall, Output, Input>
> {
  const allowedKeys = new Map(
    Object.keys(schema.shape).map((key) => [key.toLowerCase(), key]),
  );

  return z
    .record(z.string(), z.any())
    .transform((rec) =>
      Object.fromEntries(
        Object.entries(rec).map((entry) => {
          const thisKey = entry[0].toLowerCase();
          const allowedKey = allowedKeys.get(thisKey);
          if (allowedKey) {
            return [allowedKey, entry[1]];
          } else {
            return entry;
          }
        }),
      ),
    )
    .pipe(schema);
}
