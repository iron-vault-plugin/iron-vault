import {
  createMeasureSetImpl,
  type MeasureSet,
  type MeasureSpec,
} from "./character";

describe("MeasureSetImpl", () => {
  const MeasureSpec: MeasureSpec = {
    heart: { dataPath: "heart", id: "heart", kind: "stat", label: "Heart" },
    momentum: {
      dataPath: "momentum",
      id: "momentum",
      kind: "meter",
      label: "Momentum",
    },
  };
  const MeasureSetImpl = createMeasureSetImpl(MeasureSpec);

  const data = {
    heart: 2,
    momentum: "1",
  };

  let measureSet: MeasureSet<MeasureSpec>;

  beforeEach(() => {
    measureSet = new MeasureSetImpl(data);
  });

  describe("keys", () => {
    test("lists all of the keys", () => {
      expect(measureSet.keys()).toEqual(["heart", "momentum"]);
    });
  });

  describe("value", () => {
    test("parses a string", () => {
      expect(measureSet.value("momentum")).toEqual(1);
    });

    test("returns the value", () => {
      expect(measureSet.value("heart")).toEqual(2);
    });

    test("uses a value if in the change set", () => {
      measureSet.setValue("momentum", 3);
      expect(measureSet.value("momentum")).toEqual(3);
    });
  });

  test("entries returns all values", () => {
    measureSet.setValue("momentum", 4);
    expect(measureSet.entries()).toEqual([
      { key: "heart", value: 2, definition: MeasureSpec.heart },
      { key: "momentum", value: 4, definition: MeasureSpec.momentum },
    ]);
  });
});
