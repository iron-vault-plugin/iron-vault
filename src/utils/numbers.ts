/** Generate array with integers between `from` and `to`. */
export function numberRange(from: number, to: number): number[] {
  if (from > to) {
    [to, from] = [from, to];
  }
  return Array(to - from + 1)
    .fill(0)
    .map((_, i) => from + i);
}
