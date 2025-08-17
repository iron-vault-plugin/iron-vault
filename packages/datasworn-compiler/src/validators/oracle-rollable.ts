import { DataswornSource } from "@datasworn/core";
import { Dice } from "@ironvault/dice";
import { Result, Unit } from "true-myth";
import { ValidationError } from "./error";

export function validateOracleRollable(
  data: DataswornSource.OracleRollable,
): Result<Unit, ValidationError[]> {
  // Implement validation logic for oracle_rollable
  const dice = Dice.tryFromDiceString(data.dice ?? "1d100");
  if (dice.isErr) {
    return Result.err([new ValidationError(dice.error.message, ["dice"])]);
  }

  const errors: ValidationError[] = [];

  const diceMin = dice.value.minRoll();
  const diceMax = dice.value.maxRoll();

  let previousMax = diceMin - 1;
  let previousMin = diceMin - 1;

  for (let i = 0; i < data.rows.length; i++) {
    const row = data.rows[i];

    const { min, max } = row.roll ?? {};
    if (min == null && max == null) continue; // both null, skip
    if (min == null || max == null) {
      errors.push(
        new ValidationError("Both min and max must be defined.", [
          "rows",
          i.toString(),
          "roll",
        ]),
      );
      continue;
    }

    if (min > max) {
      errors.push(
        new ValidationError(`Min (${min}) must be less than max (${max}).`, [
          "rows",
          i.toString(),
          "roll",
        ]),
      );
    }

    if (min < diceMin || max > diceMax) {
      errors.push(
        new ValidationError(
          `Roll range must be between ${diceMin} and ${diceMax}.`,
          ["rows", i.toString(), "roll"],
        ),
      );
    }

    if (min <= previousMax) {
      errors.push(
        new ValidationError(
          `Roll range (${min}-${max}) must not overlap with previous row's range (${previousMin}-${previousMax}).`,
          ["rows", i.toString(), "roll"],
        ),
      );
    } else if (min != previousMax + 1) {
      if (previousMax === diceMin - 1) {
        errors.push(
          new ValidationError(
            `First row must start at ${diceMin}, but starts at ${min}.`,
            ["rows", i.toString(), "roll"],
          ),
        );
      } else {
        errors.push(
          new ValidationError(
            `Roll range (${min}-${max}) must be contiguous with previous row's range (${previousMin}-${previousMax}).`,
            ["rows", i.toString(), "roll"],
          ),
        );
      }
    }

    previousMin = min;
    previousMax = max;
  }

  if (previousMax < diceMax) {
    errors.push(
      new ValidationError(
        `Final row must end at ${diceMax}, but ends at ${previousMax}.`,
        ["rows", (data.rows.length - 1).toString(), "roll"],
      ),
    );
  }

  if (errors.length > 0) {
    return Result.err(errors);
  }

  return Result.ok(Unit);
}
