import { describe, expect, it } from "vitest";
import { extractActorFromName } from "./actor";

describe("extractActorFromName", () => {
  it.each`
    input                                          | output
    ${"Ash Barlowe"}                               | ${{ name: "Ash Barlowe" }}
    ${"[[Characters/Ash Barlowe.md|Ash Barlowe]]"} | ${{ name: "Ash Barlowe", path: "Characters/Ash Barlowe.md" }}
    ${"[[Ash Barlowe]]"}                           | ${{ name: "Ash Barlowe", path: "Ash Barlowe" }}
  `("matches $input", ({ input, output }) => {
    expect(extractActorFromName(input)).toEqual(output);
  });
});
