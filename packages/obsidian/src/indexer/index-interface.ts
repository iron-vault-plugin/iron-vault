import { EventRef } from "obsidian";
import Result from "true-myth/result";
import { ReadonlyVersionedMap, VersionedMap } from "utils/versioned-map";

export type ReadonlyIndex<T, E> = ReadonlyVersionedMap<string, Result<T, E>>;

export type AsEmitting<I> =
  I extends Index<infer T, infer E>
    ? EmittingIndex<T, E>
    : I extends ReadonlyIndex<infer T, infer E>
      ? EmittingIndex<T, E>
      : never;

export interface Index<T, E> extends VersionedMap<string, Result<T, E>> {
  /** Rename the old key to the new key, returning true if old key was found. */
  rename(oldPath: string, newPath: string): boolean;
}

export interface EmittingIndex<T, E> extends Index<T, E> {
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
