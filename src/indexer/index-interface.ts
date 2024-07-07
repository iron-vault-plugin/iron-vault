import { EventRef } from "obsidian";
import { Either } from "utils/either";
import { ReadonlyVersionedMap, VersionedMap } from "utils/versioned-map";

export type ReadonlyIndex<T, E extends Error> = ReadonlyVersionedMap<
  string,
  Either<E, T>
>;

export interface Index<T, E extends Error>
  extends VersionedMap<string, Either<E, T>> {
  readonly ofValid: ReadonlyMap<string, T>;

  /** Rename the old key to the new key, returning true if old key was found. */
  rename(oldPath: string, newPath: string): boolean;

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
