export function mapValues<K, V, U>(
  map: Map<K, V>,
  transform: (value: V, key: K) => U,
): Map<K, U> {
  return new Map(
    map.entries().map(([key, value]) => [key, transform(value, key)]),
  );
}
