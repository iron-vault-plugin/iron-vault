export function createProxy<T extends object>(obj: T): [T, Map<string, any>] {
  const changeMap = new Map<string, any>();
  return [new Proxy(obj, {}), changeMap];
}
