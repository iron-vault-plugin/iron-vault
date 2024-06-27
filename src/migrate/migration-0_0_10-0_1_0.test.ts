import { replaceLinks } from "./migration-0_0_10-0_1_0";

describe("replaceLinks", () => {
  it.each`
    str                                                                                                                 | result
    ${"[test](id:classic/oracles/turning_point/combat_action)"}                                                         | ${"[test](oracle_rollable:classic/turning_point/combat_action)"}
    ${"[Character Oracles \\/ Character Name \\/ Given Name](oracle:starforged\\/oracles\\/characters\\/name\\/given)"} | ${"[Character Oracles \\/ Character Name \\/ Given Name](oracle_rollable:starforged\\/character\\/name\\/given_name)"}
    ${"[Face Danger](move:starforged\\/moves\\/adventure\\/face_danger)"}                                               | ${"[Face Danger](move:starforged\\/adventure\\/face_danger)"}
    ${"[Foo \\/ Bar \\n](oracle:starforged\\/oracles\\/characters\\/name\\/callsign)"}                                  | ${"[Foo \\/ Bar \\n](oracle_rollable:starforged\\/character\\/name\\/callsign)"}
  `("handles $str", ({ str, result }) => {
    expect(replaceLinks(str)).toEqual(result);
  });
});
