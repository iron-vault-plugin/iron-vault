export function updater<T>(
  fromData: (data: object) => T,
  toData: (obj: T) => object,
): (
  process: (processer: (data: any) => object) => Promise<void>,
  updater: (obj: T) => T,
) => Promise<T> {
  return async (process, updater) => {
    let updated: T | undefined;
    await process((data: any) => {
      updated = updater(fromData(Object.freeze(Object.assign({}, data))));
      return toData(updated);
    });
    // SAFETY: if we get here, we should have set updated.
    return updated!;
  };
}
