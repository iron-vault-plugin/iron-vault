import { EventRef } from "obsidian";
import { Either } from "utils/either";
import { ReadonlyVersionedMap, VersionedMap } from "utils/versioned-map";

export interface ReadonlyIndex<T, E extends Error>
  extends ReadonlyVersionedMap<string, Either<E, T>> {}

export type AsEmitting<I> =
  I extends Index<infer T, infer E>
    ? EmittingIndex<T, E>
    : I extends ReadonlyIndex<infer T, infer E>
      ? EmittingIndex<T, E>
      : never;

export interface Index<T, E extends Error>
  extends VersionedMap<string, Either<E, T>> {
  /** Rename the old key to the new key, returning true if old key was found. */
  rename(oldPath: string, newPath: string): boolean;
}

export interface EmittingIndex<T, E extends Error> extends Index<T, E> {
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  on(name: string, callback: (...data: any) => any, ctx?: any): EventRef;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  off(name: string, callback: (...data: any) => any): void;

  offref(ref: EventRef): void;
}
