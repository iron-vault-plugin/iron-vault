import { z } from "zod";
import { Either, Left, Right } from "./either";

export function zodResultToEither<Input, Output>(
  result: z.SafeParseReturnType<Input, Output>,
): Either<
  z.SafeParseError<Input>["error"],
  z.SafeParseSuccess<Output>["data"]
> {
  if (result.success) {
    return Right.create(result.data);
  } else {
    return Left.create(result.error);
  }
}
