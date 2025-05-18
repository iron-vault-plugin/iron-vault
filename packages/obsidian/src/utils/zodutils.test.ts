import { z } from "zod";
import { normalizeKeys } from "./zodutils";

describe("normalizeKeys", () => {
  const schema = z.object({
    alllower: z.string(),
    mixedCase: z.string(),
  });

  describe("when using the schema", () => {
    const normalizedSchema = normalizeKeys(schema);
    it("accepts keys of the original case", () => {
      expect(
        normalizedSchema.parse({ alllower: "val1", mixedCase: "val2" }),
      ).toEqual({
        alllower: "val1",
        mixedCase: "val2",
      });
    });
    it("accepts keys of different case", () => {
      expect(
        normalizedSchema.parse({ AllLower: "val1", MIXEDcase: "val2" }),
      ).toEqual({
        alllower: "val1",
        mixedCase: "val2",
      });
    });
  });
  describe("on a strict schema", () => {
    const normalizedSchema = normalizeKeys(schema.strict());
    it("does not permit additional keys on a non-passthrough schema", () => {
      expect(
        normalizedSchema.safeParse({
          allLower: "val1",
          mixedCase: "val2",
          otherKey: "val3",
        }),
      ).toMatchObject({ success: false });
    });
  });
  describe("on a passthrough schema", () => {
    const normalizedSchema = normalizeKeys(schema.passthrough());
    it("passes additional keys unmodifid", () => {
      expect(
        normalizedSchema.parse({
          AllLower: "val1",
          MixedCase: "val2",
          otherKey: "val3",
        }),
      ).toEqual({
        alllower: "val1",
        mixedCase: "val2",
        otherKey: "val3",
      });
    });
  });
});
