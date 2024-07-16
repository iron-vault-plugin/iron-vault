import { hasOldId, replaceIds, replaceLinks } from "./migration-0_0_10-0_1_0";

const TEST_CASES: { str: string; result: string; skipLink?: boolean }[] = [
  {
    str: "[test](id:classic/oracles/turning_point/combat_action)",
    result:
      "[test](datasworn:oracle_rollable:classic/turning_point/combat_action)",
  },
  {
    str: "[Character Oracles \\/ Character Name \\/ Given Name](oracle:starforged\\/oracles\\/characters\\/name\\/given)",
    result:
      "[Character Oracles \\/ Character Name \\/ Given Name](datasworn:oracle_rollable:starforged\\/character\\/name\\/given_name)",
  },
  {
    str: "[Face Danger](move:starforged\\/moves\\/adventure\\/face_danger)",
    result:
      "[Face Danger](datasworn:move:starforged\\/adventure\\/face_danger)",
  },
  {
    str: "[Foo \\/ Bar \\n](oracle:starforged\\/oracles\\/characters\\/name\\/callsign)",
    result:
      "[Foo \\/ Bar \\n](datasworn:oracle_rollable:starforged\\/character\\/name\\/callsign)",
  },
  {
    str: "- id: starforged/assets/command_vehicle/starship",
    result: "- id: asset:starforged/command_vehicle/starship",
    skipLink: true,
  },
  {
    str: "constructor(leaf)",
    result: "constructor(leaf)",
  },
];

describe("replaceLinks", () => {
  it.each(TEST_CASES)("handles $str", ({ str, result, skipLink }) => {
    expect(replaceLinks(str)).toEqual(skipLink ? str : result);
  });
});

describe("replaceIds", () => {
  it.each(TEST_CASES)("handles $str", ({ str, result }) => {
    expect(replaceIds(str)).toEqual(result);
  });

  it("can track specific replacements", () => {
    const log: { offset: number; length: number; newId: string }[] = [];
    replaceIds(
      "test oracle:starforged/oracles/characters/name/callsign foo",
      log,
    );
    expect(log).toEqual([
      {
        offset: 5,
        length: "oracle:starforged/oracles/characters/name/callsign".length,
        newId: "oracle_rollable:starforged/character/name/callsign",
      },
    ]);
  });
});

describe("hasOldIds", () => {
  it.each(TEST_CASES)("finds old ID in $str", ({ str, result }) => {
    expect(hasOldId(str)).toBe(str != result);
  });
});
