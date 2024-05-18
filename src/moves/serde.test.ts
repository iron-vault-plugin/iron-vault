import { parseMoveBlock } from "./serde";

describe("parseMoveBlock", () => {
  it("parses move yaml v2", () => {
    expect(
      parseMoveBlock(
        `name: example
stat: wits
statVal: 2
challenge1: 1
challenge2: 3
action: 1
adds:
  - amount: 1
    desc: foo

    `,
      ),
    ).toMatchObject({ value: { adds: [{ amount: 1, desc: "foo" }] } });
  });

  it("parses move yaml v1", () => {
    expect(
      parseMoveBlock(
        `name: example
stat: wits
statVal: 2
challenge1: 1
challenge2: 3
action: 1
adds: 2

`,
      ),
    ).toMatchObject({ value: { adds: [{ amount: 2 }] } });
  });
});
