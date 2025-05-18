import { describe, expect, it } from "vitest";
import { generateObsidianFilename } from "./filename";

describe("generateObsidianFilename", () => {
  it.each`
    input                        | output
    ${"this / has inv # char's"} | ${"This has inv char's"}
    ${" # trimmed # "}           | ${"Trimmed"}
  `("formats $input", ({ input, output }) => {
    expect(generateObsidianFilename(input)).toEqual(output);
  });
});
