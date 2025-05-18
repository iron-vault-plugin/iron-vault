export function partition<T, U extends T = T>(
  items: Iterable<T>,
  partFn: (elem: T) => elem is U,
): [U[], T[]] {
  const left: U[] = [];
  const right: T[] = [];
  for (const elem of items) {
    if (partFn(elem)) {
      left.push(elem);
    } else {
      right.push(elem);
    }
  }
  return [left, right];
}
