import Result, { err, ok } from "true-myth/result";
import { z } from "zod";

export function zodResultToResult<T>(
  result: z.ZodSafeParseResult<T>,
): Result<T, z.ZodError<T>> {
  if (result.success) {
    return ok(result.data);
  } else {
    return err(result.error);
  }
}

export function normalizeKeys<O extends z.ZodObject>(
  schema: O,
): z.ZodPipe<z.ZodTransform<unknown, unknown>, O> {
  const allowedKeys = new Map(
    Object.keys(schema._zod.def.shape).map((key) => [key.toLowerCase(), key]),
  );

  return z.preprocess((data) => {
    if (typeof data !== "object" || data == null) {
      return data;
    }
    const mapped = Object.fromEntries(
      Object.entries(data).map(([key, value]) => [
        allowedKeys.get(key.toLowerCase()) ?? key,
        value,
      ]),
    );
    return mapped;
  }, schema);
}
