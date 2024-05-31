import { EventRef, Events } from "obsidian";
import { Either } from "utils/either";
import { resultFilteredMapClass } from "../utils/filtered-map";
import { Index } from "./index-interface";

export class IndexImpl<T, E extends Error> implements Index<T, E> {
  readonly ofValid: ReadonlyMap<string, T> = new (resultFilteredMapClass<
    string,
    T,
    E
  >())(this);
  readonly events: Events = new Events();
  readonly #map: Map<string, Either<E, T>> = new Map();

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

  entries(): IterableIterator<[string, Either<E, T>]> {
    return this.#map.entries();
  }

  keys(): IterableIterator<string> {
    return this.#map.keys();
  }

  values(): IterableIterator<Either<E, T>> {
    return this.#map.values();
  }

  [Symbol.iterator](): IterableIterator<[string, Either<E, T>]> {
    return this.#map[Symbol.iterator]();
  }

  get [Symbol.toStringTag](): string {
    return this.#map[Symbol.toStringTag];
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  on(name: "changed", callback: (path: string) => any, ctx?: any): EventRef;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  on(name: string, callback: (...data: any) => any, ctx?: any): EventRef {
    return this.events.on(name, callback, ctx);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  off(name: string, callback: (...data: any) => any): void {
    this.events.off(name, callback);
  }

  offref(ref: EventRef): void {
    this.events.offref(ref);
  }

  trigger(name: "changed", path: string): void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  trigger(name: string, ...data: any[]): void {
    this.events.trigger(name, ...data);
  }
}
