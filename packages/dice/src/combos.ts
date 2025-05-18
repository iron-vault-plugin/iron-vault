/**
 * Utility functions for handling combinations of dice (e.g., 1d6;1d6).
 */
import { NumberRange, parseRanges } from "@ironvault/utils/numbers";
import { Dice } from "./dice";

/** Given a dice combination and a set of range values for each die, flatten the ranges
 * into a set of ranges for a single flattened dice.
 * For example, given 1d6;1d6 and ranges 1-2;3-4, the result would be [[3-4, 9-10]].
 */
export function flattenRangeExpr(dice: Dice[], input: string): NumberRange[] {
  const ranges = parseRanges(input);
  if (!ranges) {
    throw new Error(`invalid range expression ${input}`);
  }

  if (ranges.length != dice.length) {
    throw new Error(
      `expected ${dice.length} ranges, found ${ranges.length}: ${input}`,
    );
  }

  function recurse(
    index: number,
    rowRanges: NumberRange[],
    placeValue: number,
  ): NumberRange[] {
    if (index < 0) {
      return rowRanges;
    }
    const newRanges: NumberRange[] = [];
    const placeDice = dice[index];
    const placeRange = ranges![index];
    if (rowRanges.length === 0) {
      return recurse(index - 1, [placeRange], placeValue * placeDice.sides);
    }
    for (const r of rowRanges) {
      for (let i = placeRange.min; i <= placeRange.max; i++) {
        newRanges.push({
          min: r.min + (i - 1) * placeValue,
          max: r.max + (i - 1) * placeValue,
        });
      }
    }
    return recurse(index - 1, newRanges, placeValue * placeDice.sides);
  }

  return recurse(ranges.length - 1, [], 1);
} /** Given a dice combination, flatten to a single roll  if possible. */

export function flattenDiceCombination(dice: Dice[]): Dice {
  if (dice.length === 1) {
    return dice[0];
  }
  return new Dice(
    1,
    dice.reduceRight((acc, d) => {
      if (d.count > 1) {
        throw new Error("cannot flatten dice with multiple counts");
      }
      return acc * d.sides;
    }, 1),
  );
}
