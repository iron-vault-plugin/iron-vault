import { hasOldId, replaceIds, replaceLinks } from "./migration-0_0_10-0_1_0";

const TEST_CASES: { str: string; result: string }[] = [
  {
    str: "[test](id:classic/oracles/turning_point/combat_action)",
    result: "[test](oracle_rollable:classic/turning_point/combat_action)",
  },
  {
    str: "[Character Oracles \\/ Character Name \\/ Given Name](oracle:starforged\\/oracles\\/characters\\/name\\/given)",
    result:
      "[Character Oracles \\/ Character Name \\/ Given Name](oracle_rollable:starforged\\/character\\/name\\/given_name)",
  },
  {
    str: "[Face Danger](move:starforged\\/moves\\/adventure\\/face_danger)",
    result: "[Face Danger](move:starforged\\/adventure\\/face_danger)",
  },
  {
    str: "[Foo \\/ Bar \\n](oracle:starforged\\/oracles\\/characters\\/name\\/callsign)",
    result:
      "[Foo \\/ Bar \\n](oracle_rollable:starforged\\/character\\/name\\/callsign)",
  },
];

describe("replaceLinks", () => {
  it.each(TEST_CASES)("handles $str", ({ str, result }) => {
    expect(replaceLinks(str)).toEqual(result);
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
  it.each(TEST_CASES)("finds old ID in $str", ({ str }) => {
    expect(hasOldId(str)).toBe(true);
  });
});
