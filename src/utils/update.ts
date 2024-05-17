export function updater<T>(
  fromData: (data: object) => T,
  toData: (obj: T) => object,
): (
  process: (processer: (data: unknown) => object) => Promise<void>,
  updater: (obj: T) => T,
) => Promise<T> {
  return async (process, updater) => {
    let updated: T | undefined;
    await process((data: unknown) => {
      updated = updater(fromData(Object.freeze(Object.assign({}, data))));
      return toData(updated);
    });
    // SAFETY: if we get here, we should have set updated.
    return updated!;
  };
}

export function updaterWithContext<T, U>(
  fromData: (data: object) => T,
  toData: (obj: T) => object,
  context: U,
): (
  process: (processer: (data: unknown) => object) => Promise<void>,
  updater: (obj: T, context: U) => T,
) => Promise<T> {
  return async (process, updater) => {
    let updated: T | undefined;
    await process((data: unknown) => {
      updated = updater(
        fromData(Object.freeze(Object.assign({}, data))),
        context,
      );
      return toData(updated);
    });
    // SAFETY: if we get here, we should have set updated.
    return updated!;
  };
}
