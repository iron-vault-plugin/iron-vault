class DuplicateKeysError extends Error {}
export function ensureUnique<T>(...seqs: Iterable<T>[]): void {
  const seen = new Set<T>();
  const duplicate = new Set<T>();

  for (const seq of seqs) {
    for (const elem of seq) {
      if (seen.has(elem)) {
        duplicate.add(elem);
      } else {
        seen.add(elem);
      }
    }
  }

  if (duplicate.size > 0) {
    throw new DuplicateKeysError(
      `expected unique keys, but following were duplicated: ${[...duplicate.keys()]}`,
    );
  }
}
