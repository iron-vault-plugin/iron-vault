import { DataswornSource } from "@datasworn/core";
import { Result, Unit } from "true-myth";
import { type ValidationError } from "./error";
import { validateOracleRollable } from "./oracle-rollable";

export type { ValidationError };

export function validate<
  T extends
    | DataswornSource.OracleRollable
    | DataswornSource.Move
    | DataswornSource.Asset,
>(data: T): Result<Unit, ValidationError[]> {
  switch (data.type) {
    case "oracle_rollable":
      return validateOracleRollable(data);
    default:
      return Result.ok(Unit);
  }
}
