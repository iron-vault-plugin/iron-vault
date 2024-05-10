import { Asset } from "@datasworn/core";
import {
  getPathLabel,
  pathed,
  samePath,
  updateAssetWithOptions,
} from "./assets";

describe("getPathLabel", () => {
  it("works with one part", () => {
    expect(getPathLabel(pathed(["foo/assets/bar", "baz"], null))).toEqual(
      "baz",
    );
  });
  it("works with two parts", () => {
    expect(getPathLabel(pathed(["foo/assets/bar", "1", "2"], null))).toEqual(
      "1/2",
    );
  });
});

describe("samePath", () => {
  it("is true for identical paths", () => {
    expect(
      samePath(pathed(["foo/bar", "1"], null), pathed(["foo/bar", "1"], null)),
    ).toBe(true);
  });

  it("is false for different paths", () => {
    expect(
      samePath(pathed(["foo/bar", "1"], null), pathed(["foo/bar", "2"], null)),
    ).toBe(false);
  });
});

describe("updateAssetWithOptions", () => {
  const starship: Asset = {
    id: "starforged/assets/command_vehicle/starship",
    name: "Starship",
    category: "Command Vehicle",
    color: "#9aa3ad",
    options: {
      label: {
        label: "name",
        field_type: "text",
        value: null,
      },
    },
    count_as_impact: false,
    shared: true,
    attachments: {
      max: null,
      assets: ["*/assets/module/*"],
    },
    abilities: [
      {
        id: "starforged/assets/command_vehicle/starship/abilities/0",
        enabled: true,
        text: "Your armed, multipurpose starship is suited for interstellar and atmospheric flight. It can comfortably transport several people, has space for cargo, and can carry and launch support vehicles. When you [Advance](id:starforged/moves/legacy/advance), you may spend experience to equip this vehicle with module assets.",
        enhance_moves: [
          {
            roll_type: "no_roll",
            enhances: ["starforged/moves/legacy/advance"],
          },
        ],
      },
      {
        id: "starforged/assets/command_vehicle/starship/abilities/1",
        enabled: false,
        text: "When you [Finish an Expedition](id:starforged/moves/exploration/finish_an_expedition) (dangerous or greater) in your starship and score a hit, this journey strengthened your ties to your ship and any fellow travelers. You and your allies may mark 1 tick on your bonds legacy track.",
        enhance_moves: [
          {
            roll_type: "progress_roll",
            enhances: ["starforged/moves/exploration/finish_an_expedition"],
            trigger: {
              conditions: [
                {
                  method: null,
                  roll_options: null,
                  text: "In your starship (dangerous or greater)",
                },
              ],
            },
          },
        ],
      },
      {
        id: "starforged/assets/command_vehicle/starship/abilities/2",
        enabled: false,
        text: "When you [Withstand Damage](id:starforged/moves/suffer/withstand_damage), you may roll +heart. If you do, [Endure Stress](id:starforged/moves/suffer/endure_stress) (-1) on a weak hit or miss.",
        enhance_moves: [
          {
            roll_type: "action_roll",
            enhances: ["starforged/moves/suffer/withstand_damage"],
            trigger: {
              conditions: [
                {
                  method: "player_choice",
                  roll_options: [
                    {
                      using: "stat",
                      stat: "heart",
                    },
                  ],
                  text: "To your Starship",
                },
              ],
            },
          },
        ],
      },
    ],
    controls: {
      integrity: {
        label: "integrity",
        field_type: "condition_meter",
        rollable: true,
        min: 0,
        max: 5,
        value: 5,
        controls: {
          battered: {
            label: "battered",
            field_type: "checkbox",
            value: false,
            is_impact: true,
            disables_asset: false,
          },
          cursed: {
            label: "cursed",
            field_type: "checkbox",
            value: false,
            is_impact: true,
            disables_asset: false,
          },
        },
        moves: {
          recover: ["starforged/moves/recover/repair"],
          suffer: ["starforged/moves/suffer/withstand_damage"],
        },
      },
    },
    source: {
      title: "Ironsworn: Starforged Assets",
      authors: [
        {
          name: "Shawn Tomkin",
        },
      ],
      date: "2022-05-06",
      url: "https://ironswornrpg.com",
      license: "https://creativecommons.org/licenses/by/4.0",
    },
  };
  it("updates the values", () => {
    expect(updateAssetWithOptions(starship, { label: "foo" })).toMatchObject({
      options: { label: { value: "foo" } },
    });
  });
  it("updates only the key given", () => {
    expect(updateAssetWithOptions(starship, { bar: "foo" })).toMatchObject({
      options: { label: { value: null } },
    });
  });
  it("creates a new object and leaves the old unchanged", () => {
    const updated = updateAssetWithOptions(starship, { label: "foo" });
    expect(updated).not.toBe(starship);
    expect(starship).toHaveProperty(["options", "label", "value"], null);
  });
});
