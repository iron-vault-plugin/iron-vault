import { EventRef, Events } from "obsidian";
import { Either } from "utils/either";
import {
  ProjectableMap,
  projectedVersionedMap,
  ReadonlyVersionedMap,
  VersionedMap,
  VersionedMapImpl,
} from "utils/versioned-map";
import { EmittingIndex } from "./index-interface";

/** Filter map down to only valid entries. */
export function onlyValid<K, T, E extends Error>(
  map: ReadonlyVersionedMap<K, Either<E, T>>,
): ProjectableMap<K, T> {
  return projectedVersionedMap(map, (result) =>
    result.isRight() ? result.value : undefined,
  );
}

/** Filter map down to only invalid entries. */
export function onlyInvalid<K, T, E extends Error>(
  map: ReadonlyVersionedMap<K, Either<E, T>>,
): ProjectableMap<K, E> {
  return projectedVersionedMap(map, (result) =>
    result.isLeft() ? result.error : undefined,
  );
}

export class IndexImpl<T, E extends Error> implements EmittingIndex<T, E> {
  readonly events: Events = new Events();
  readonly #map: VersionedMap<string, Either<E, T>> = new VersionedMapImpl();

  get revision(): number {
    return this.#map.revision;
  }

  clear(): void {
    const keys = [...this.#map.keys()];
    this.#map.clear();
    for (const key of keys) {
      this.trigger("changed", key);
    }
  }

  delete(key: string): boolean {
    if (this.#map.delete(key)) {
      this.trigger("changed", key);
      return true;
    } else {
      return false;
    }
  }

  forEach(
    callbackfn: (
      value: Either<E, T>,
      key: string,
      map: Map<string, Either<E, T>>,
    ) => void,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    thisArg?: any,
  ): void {
    this.#map.forEach(callbackfn, thisArg);
  }

  get(key: string): Either<E, T> | undefined {
    return this.#map.get(key);
  }

  has(key: string): boolean {
    return this.#map.has(key);
  }

  set(key: string, value: Either<E, T>): this {
    this.#map.set(key, value);
    this.trigger("changed", key);
    return this;
  }

  get size(): number {
    return this.#map.size;
  }

  entries(): MapIterator<[string, Either<E, T>]> {
    return this.#map.entries();
  }

  keys(): MapIterator<string> {
    return this.#map.keys();
  }

  values(): MapIterator<Either<E, T>> {
    return this.#map.values();
  }

  [Symbol.iterator](): MapIterator<[string, Either<E, T>]> {
    return this.#map[Symbol.iterator]();
  }

  get [Symbol.toStringTag](): string {
    return this.#map[Symbol.toStringTag];
  }

  rename(oldPath: string, newPath: string): boolean {
    const previous = this.get(oldPath);
    if (previous) {
      this.#map.delete(oldPath);
      this.#map.set(newPath, previous);
      this.trigger("renamed", oldPath, newPath);
      return true;
    } else {
      return false;
    }
  }

  on(
    name: "changed",
    callback: (path: string) => unknown,
    ctx?: unknown,
  ): EventRef;
  on(
    name: "renamed",
    callback: (oldPath: string, newPath: string) => unknown,
    ctx?: unknown,
  ): EventRef;
  on(
    name: string,
    callback: (...data: never[]) => unknown,
    ctx?: unknown,
  ): EventRef {
    return this.events.on(name, callback, ctx);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  off(name: string, callback: (...data: any) => any): void {
    this.events.off(name, callback);
  }

  offref(ref: EventRef): void {
    this.events.offref(ref);
  }

  protected trigger(name: "changed", path: string): void;
  protected trigger(name: "renamed", oldPath: string, newPath: string): void;
  protected trigger(name: string, ...data: never[]): void {
    this.events.trigger(name, ...data);
  }
}
