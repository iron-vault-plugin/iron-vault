export function sameElementsInArray<T>(
  eq: (arg1: T, arg2: T) => boolean,
): (arg1: T[], arg2: T[]) => boolean {
  return (arg1, arg2) => {
    if (arg1.length !== arg2.length) return false;
    return arg1.every((val1) => arg2.find((val2) => eq(val1, val2)));
  };
}

export const sameValueElementsInArray = sameElementsInArray(Object.is);
