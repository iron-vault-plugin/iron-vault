import { describe, expect, it } from "vitest";
import { prop } from "./lens";

describe("prop", () => {
  it("gets a key from an object", () => {
    const lens = prop<number>("foo");
    expect(lens.get({ foo: 3 })).toBe(3);
  });

  it("updates a key if new value", () => {
    const lens = prop<number>("foo");
    expect(lens.update({ foo: 3 }, 4)).toEqual({ foo: 4 });
  });

  it("returns the original object if update passed the original value", () => {
    const lens = prop<number>("foo");
    const obj = { foo: 3 };
    expect(lens.update(obj, 3)).toBe(obj);
  });
});
