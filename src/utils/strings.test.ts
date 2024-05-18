import { makeSafeForId } from "./strings";

describe("makeSafeForId", () => {
  it.each`
    str                    | id
    ${"Test string"}       | ${"test_string"}
    ${"[[Foo   bar's x]]"} | ${"foo_bar_s_x"}
  `("reformats $str", ({ str, id }) => {
    expect(makeSafeForId(str)).toBe(id);
  });
});
