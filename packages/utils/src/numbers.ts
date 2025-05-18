export interface NumberRange {
  min: number;
  max: number;
}

/** Generate a random integer between `min` and `max` (inclusive). */
export function randomInt(min: number, max: number): number {
  const randomBuffer = new Uint32Array(1);

  crypto.getRandomValues(randomBuffer);

  const randomNumber = randomBuffer[0] / (4294967295 + 1);
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(randomNumber * (max - min + 1) + min);
}

/** Generate array with integers between `from` and `to` (inclusive). */
export function numberRange(from: number, to: number): number[] {
  if (from > to) {
    [to, from] = [from, to];
  }
  return Array(to - from + 1)
    .fill(0)
    .map((_, i) => from + i);
}

/** Generate array with integers between `from` and `to` (exclusive of to). */
export function numberRangeExclusive(from: number, to: number): number[] {
  if (from > to) {
    throw new Error(
      `Invalid range: from (${from}) cannot be greater than to (${to})`,
    );
  }
  return Array(to - from)
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

export const numbers: string[] = [
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
