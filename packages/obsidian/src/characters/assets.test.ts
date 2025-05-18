import { type Datasworn } from "@datasworn/core";
import { IDataContext, MockDataContext } from "datastore/data-context";
import { produce } from "immer";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { integratedAssetLens, walkAsset } from "./assets";

const starship = () =>
  ({
    _id: "starforged/assets/command_vehicle/starship",
    type: "asset",
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
        _id: "starforged/assets/command_vehicle/starship/abilities/0",
        enabled: true,
        text: "Your armed, multipurpose starship is suited for interstellar and atmospheric flight. It can comfortably transport several people, has space for cargo, and can carry and launch support vehicles. When you [Advance](id:starforged/moves/legacy/advance), you may spend experience to equip this vehicle with module assets.",
        enhance_moves: [
          {
            roll_type: "no_roll",
            enhances: ["starforged/moves/legacy/advance"],
          },
        ],
        options: {
          made_up: { field_type: "text", label: "made up", value: null },
        },
      },
      {
        _id: "starforged/assets/command_vehicle/starship/abilities/1",
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
        _id: "starforged/assets/command_vehicle/starship/abilities/2",
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
    _source: {
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
  }) satisfies Datasworn.Asset;

describe("walkAsset", () => {
  it("triggers on asset options", () => {
    const mock = vi.fn(() => void undefined);
    walkAsset(starship(), {
      onBaseOption: mock,
    });
    expect(mock).toHaveBeenCalledWith("label", starship().options.label);
  });

  it("triggers on asset controls", () => {
    const mock = vi.fn(() => void undefined);
    walkAsset(starship(), {
      onBaseControl: mock,
    });
    expect(mock).toHaveBeenCalledWith(
      "integrity",
      starship().controls.integrity,
    );
  });

  it("triggers on asset meter subcontrols", () => {
    const mock = vi.fn(() => void undefined);
    walkAsset(starship(), {
      onConditionMeterSubcontrol: mock,
    });

    const integrity = starship().controls.integrity;
    expect(mock).toHaveBeenNthCalledWith(
      1,
      "battered",
      integrity.controls.battered,
      integrity,
      "integrity",
    );
    expect(mock).toHaveBeenNthCalledWith(
      2,
      "cursed",
      integrity.controls.cursed,
      integrity,
      "integrity",
    );
  });

  it("triggers on marked ability", () => {
    const mock = vi.fn(() => void undefined);
    walkAsset(
      starship(),
      {
        onAbilityOption: mock,
      },
      [true, false, false],
    );

    const firstAbility = starship().abilities[0];
    expect(mock).toHaveBeenCalledWith(
      "made_up",
      firstAbility.options?.made_up,
      firstAbility,
      0,
    );
  });

  it("does not trigger on marked ability", () => {
    const mock = vi.fn(() => void undefined);
    walkAsset(
      starship(),
      {
        onAbilityOption: mock,
      },
      [false, true, false],
    );

    expect(mock).not.toHaveBeenCalled();
  });
});

describe("integratedAssetLens", () => {
  let dataContext: IDataContext;

  beforeEach(() => {
    dataContext = new MockDataContext({ assets: [starship()] });
  });

  describe("#get", () => {
    it("updates marked abilities", () => {
      expect(
        integratedAssetLens(dataContext).get({
          id: starship()._id,
          abilities: [true, false, true],
          options: {},
          controls: {},
        }),
      ).toMatchObject({
        abilities: [{ enabled: true }, { enabled: false }, { enabled: true }],
      });
    });

    it("integrates option values", () => {
      expect(
        integratedAssetLens(dataContext).get({
          id: starship()._id,
          abilities: [true, false, false],
          options: {},
          controls: {},
        }),
      ).toHaveProperty("options.label.value", null);
      expect(
        integratedAssetLens(dataContext).get({
          id: starship()._id,
          abilities: [true, false, false],
          options: { label: "arclight" },
          controls: {},
        }),
      ).toHaveProperty("options.label.value", "arclight");
    });
    it("integrates meter values", () => {
      expect(
        integratedAssetLens(dataContext).get({
          id: starship()._id,
          abilities: [true, false, false],
          options: {},
          controls: {},
        }),
      ).toHaveProperty("controls.integrity.value", 5);
      expect(
        integratedAssetLens(dataContext).get({
          id: starship()._id,
          abilities: [true, false, false],
          options: {},
          controls: { integrity: 3 },
        }),
      ).toHaveProperty("controls.integrity.value", 3);
    });

    it("integrates meter subfield values", () => {
      expect(
        integratedAssetLens(dataContext).get({
          id: starship()._id,
          abilities: [true, false, false],
          options: {},
          controls: {},
        }),
      ).toHaveProperty("controls.integrity.controls.battered.value", false);
      expect(
        integratedAssetLens(dataContext).get({
          id: starship()._id,
          abilities: [true, false, false],
          options: {},
          controls: { "integrity/battered": true },
        }),
      ).toHaveProperty("controls.integrity.controls.battered.value", true);
    });

    it("integrates ability values", () => {
      expect(
        integratedAssetLens(dataContext).get({
          id: starship()._id,
          abilities: [false, false, false],
          options: {},
          controls: {},
        }),
      ).toHaveProperty("abilities.0.options.made_up.value", null);
      expect(
        integratedAssetLens(dataContext).get({
          id: starship()._id,
          abilities: [false, false, false],
          options: { "0/made_up": "foo" },
          controls: {},
        }),
      ).toHaveProperty("abilities.0.options.made_up.value", "foo");
    });
  });

  it("update", () => {
    expect(
      integratedAssetLens(dataContext).update(
        {
          id: starship()._id,
          abilities: [false, false, false],
          options: {},
          controls: {},
        },
        produce(starship(), (draft) => {
          draft.abilities[0].enabled = true;
          draft.abilities[1].enabled = true;
          draft.options.label.value = "arclight" as never;
          draft.controls.integrity.value = 3;
          draft.controls.integrity.controls.battered.value = true as never;
        }),
      ),
    ).toEqual({
      id: starship()._id,
      abilities: [true, true, false],
      options: { label: "arclight", "0/made_up": null },
      controls: {
        integrity: 3,
        "integrity/battered": true,
        "integrity/cursed": false,
      },
    });
  });
});
