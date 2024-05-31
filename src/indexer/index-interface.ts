import { EventRef } from "obsidian";
import { Either } from "utils/either";

export interface Index<T, E extends Error> extends Map<string, Either<E, T>> {
  readonly ofValid: ReadonlyMap<string, T>;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  on(name: "changed", callback: (path: string) => any, ctx?: any): EventRef;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  on(name: string, callback: (...data: any) => any, ctx?: any): EventRef;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  off(name: string, callback: (...data: any) => any): void;

  offref(ref: EventRef): void;

  trigger(name: "changed", path: string): void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  trigger(name: string, ...data: any[]): void;
}
