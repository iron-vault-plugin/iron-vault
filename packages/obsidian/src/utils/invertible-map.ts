/** A map that maintains an index of values, which are not presumed unique.
 */
export class IndexingMap<K, V> implements Map<K, V> {
  #forward: Map<K, V> = new Map();
  #backwards: Map<V, Set<K>> = new Map();

  readonly EMPTY_SET: ReadonlySet<K> = new Set();

  constructor(iterable?: Iterable<readonly [K, V]> | undefined | null) {
    if (iterable) {
      for (const [k, v] of iterable) this.set(k, v);
    }
  }

  clear(): void {
    this.#forward.clear();
    this.#backwards.clear();
  }

  delete(key: K): boolean {
    const value = this.#forward.get(key);
    if (value) {
      this.#backwards.get(value)?.delete(key);
    }
    return this.#forward.delete(key);
  }

  forEach(
    callbackfn: (value: V, key: K, map: Map<K, V>) => void,
    thisArg?: unknown,
  ): void {
    this.#forward.forEach((v, k) => callbackfn(v, k, this), thisArg);
  }

  get(key: K): V | undefined {
    return this.#forward.get(key);
  }

  getKeysForValue(value: V): ReadonlySet<K> {
    return this.#backwards.get(value) ?? this.EMPTY_SET;
  }

  has(key: K): boolean {
    return this.#forward.has(key);
  }

  private _addBackwardsValue(key: K, value: V) {
    let backSet = this.#backwards.get(value);
    if (!backSet) {
      this.#backwards.set(value, (backSet = new Set()));
    }
    backSet.add(key);
  }

  set(key: K, value: V): this {
    const existingValue = this.#forward.get(key);
    if (existingValue) {
      this.#backwards.get(existingValue)?.delete(key);
    }
    this.#forward.set(key, value);
    this._addBackwardsValue(key, value);
    return this;
  }

  get size(): number {
    return this.#forward.size;
  }

  entries(): MapIterator<[K, V]> {
    return this.#forward.entries();
  }
  keys(): MapIterator<K> {
    return this.#forward.keys();
  }
  values(): MapIterator<V> {
    return this.#forward.values();
  }
  [Symbol.iterator](): MapIterator<[K, V]> {
    return this.#forward[Symbol.iterator]();
  }
  get [Symbol.toStringTag](): string {
    return "InvertibleMap";
  }
}

/** A map that maintains an index of values, which are not presumed unique.
 */
export class IndexingMultiMap<K, V> {
  #forward: Map<K, Set<V>> = new Map();
  #backwards: Map<V, Set<K>> = new Map();

  readonly EMPTY_SET: ReadonlySet<K> = new Set();

  constructor(iterable?: Iterable<readonly [K, V]> | undefined | null) {
    if (iterable) {
      for (const [k, v] of iterable) this.add(k, v);
    }
  }

  clear(): void {
    this.#forward.clear();
    this.#backwards.clear();
  }

  delete(key: K): boolean {
    const values = this.#forward.get(key);
    if (values) {
      for (const value of values) {
        this.#backwards.get(value)?.delete(key);
      }
    }
    return this.#forward.delete(key);
  }

  get(key: K): ReadonlySet<V> | undefined {
    return this.#forward.get(key);
  }

  getKeysForValue(value: V): ReadonlySet<K> {
    return this.#backwards.get(value) ?? this.EMPTY_SET;
  }

  has(key: K): boolean {
    return this.#forward.has(key);
  }

  private _addForwardsValue(key: K, value: V) {
    let forwardSet = this.#forward.get(key);
    if (!forwardSet) {
      this.#forward.set(key, (forwardSet = new Set()));
    }
    forwardSet.add(value);
  }

  private _addBackwardsValue(key: K, value: V) {
    let backSet = this.#backwards.get(value);
    if (!backSet) {
      this.#backwards.set(value, (backSet = new Set()));
    }
    backSet.add(key);
  }

  add(key: K, value: V): this {
    this._addForwardsValue(key, value);
    this._addBackwardsValue(key, value);
    return this;
  }

  set(key: K, values: Iterable<V>) {
    this.delete(key);
    for (const value of values) {
      this.add(key, value);
    }
  }

  get size(): number {
    return this.#forward.size;
  }

  get [Symbol.toStringTag](): string {
    return "InvertibleMultiMap";
  }
}
