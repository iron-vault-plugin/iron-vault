import { extractDataswornLinkParts } from "./id";

describe("extractDataswornLinkParts", () => {
  it.each([
    ["asset:starforged/path/empath", ["asset", "starforged/path/empath"]],
    [
      "asset.ability.move:starforged/path/empath.0.read_heart",
      ["asset.ability.move", "starforged/path/empath.0.read_heart"],
    ],
    ["http://asdf", null],
    ["./foo", null],
  ])("should properly handle '%s'", (link, result) => {
    expect(extractDataswornLinkParts(link)).toEqual(result);
  });
});
