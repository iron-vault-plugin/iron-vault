import { NumberRange } from "model/rolls";

/** Generate array with integers between `from` and `to`. */
export function numberRange(from: number, to: number): number[] {
  if (from > to) {
    [to, from] = [from, to];
  }
  return Array(to - from + 1)
    .fill(0)
    .map((_, i) => from + i);
}
export function parseRange(input: string): NumberRange | undefined {
  const results = input.match(/^(\d+)(?:\s*-\s*(\d+))?$/);
  if (!results) {
    return undefined;
  }
  const min = Number.parseInt(results[1]);
  if (Number.isNaN(min)) {
    return undefined;
  }
  let max: number;
  if (results[2]) {
    max = Number.parseInt(results[2]);
    if (Number.isNaN(max)) {
      return undefined;
    }
  } else {
    max = min;
  }
  return {
    min,
    max,
  };
}
export function parseRanges(input: string): NumberRange[] | undefined {
  const ranges = input.split(";").map((r) => parseRange(r.trim()));
  if (ranges.some((r) => r == null)) {
    return undefined;
  }
  return ranges as NumberRange[];
}
export const numbers = [
  "zero",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
].map((s) => "_" + s + "_");
