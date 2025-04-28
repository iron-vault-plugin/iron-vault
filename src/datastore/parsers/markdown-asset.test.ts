import { DataswornSource } from "@datasworn/core";
import { markdownAssetToDatasworn } from "./markdown-asset";

describe("markdownAssetToDatasworn", () => {
  it("parses a valid asset with frontmatter, name, requirement, and abilities", () => {
    const md = `---
foo: bar
---
# Asset Name (Path)

Requirement text

## Abilities

* [x] Ability 1
* [ ] Ability 2
* [ ] Ability 3
`;
    const result = markdownAssetToDatasworn(md);
    expect(result.unwrap()).toEqual({
      type: "asset",
      name: "Asset Name",
      requirement: "Requirement text",
      abilities: [
        { text: "Ability 1", enabled: true },
        { text: "Ability 2", enabled: false },
        { text: "Ability 3", enabled: false },
      ] satisfies DataswornSource.AssetAbility[],
      category: "Path",
    });
  });

  it("preserves ability formatting", () => {
    const md = `
# Asset Name
* [x] Your combat bot companion fights at your side. When you [Strike](datasworn:move:starforged/combat/strike) aided by the bot, add +1; if you [Clash](datasworn:move:starforged/combat/clash), take +1 momentum on a hit.
`;
    const result = markdownAssetToDatasworn(md);
    expect(result.unwrap()).toEqual({
      type: "asset",
      name: "Asset Name",
      abilities: [
        {
          text: "Your combat bot companion fights at your side. When you [Strike](datasworn:move:starforged/combat/strike) aided by the bot, add +1; if you [Clash](datasworn:move:starforged/combat/clash), take +1 momentum on a hit.",
          enabled: true,
        },
      ] satisfies DataswornSource.AssetAbility[],
      category: "unknown",
    });
  });

  it("returns error if asset name is missing", () => {
    const md = `---
foo: bar
---
Requirement text

## Abilities

* [x] Ability 1
`;
    const result = markdownAssetToDatasworn(md);
    expect(result.isLeft()).toBe(true);
    if (result.isLeft()) {
      expect(result.error.message).toMatch(/Asset must have a name/);
    }
  });

  it("parses asset without frontmatter", () => {
    const md = `# Asset Name

Requirement text

* [x] Ability 1
`;
    const result = markdownAssetToDatasworn(md);
    expect(result.isRight()).toBe(true);
    if (result.isRight()) {
      expect(result.value.name).toBe("Asset Name");
      expect(result.value.requirement).toBe("Requirement text");
    }
  });

  it("returns error if name heading is not a text node", () => {
    const md = `# **Bold Name**

Requirement text

* [x] Ability 1
`;
    const result = markdownAssetToDatasworn(md);
    expect(result.isLeft()).toBe(true);
    if (result.isLeft()) {
      expect(result.error.message).toMatch(/Name must be a text node/);
    }
  });

  it("returns error if requirement is not a text node", () => {
    const md = `# Asset Name

**Bold requirement**

* [x] Ability 1
`;
    const result = markdownAssetToDatasworn(md);
    expect(result.isLeft()).toBe(true);
    if (result.isLeft()) {
      expect(result.error.message).toMatch(/Expected a text node as child/);
    }
  });

  describe("controls and options", () => {
    const base = `---
foo: bar
---
# Asset Name (Path)

* [x] Ability 1
* [ ] Ability 2
* [ ] Ability 3
`;

    it("parses a condition meter control", () => {
      const md = `${base}

## Controls

* Test field (condition_meter, max: 5, value: 5)
`;
      const result = markdownAssetToDatasworn(md);
      expect(result.unwrap().controls).toEqual({
        test_field: {
          field_type: "condition_meter",
          min: 0,
          max: 5,
          value: 5,
          label: "test field",
        },
      } satisfies Record<string, DataswornSource.AssetControlField>);
    });

    it("parses a checkbox control", () => {
      const md = `${base}

## Controls

* Test field (checkbox, is_impact: true, disables_asset: false)
`;
      const result = markdownAssetToDatasworn(md);
      expect(result.unwrap().controls).toEqual({
        test_field: {
          field_type: "checkbox",
          is_impact: true,
          disables_asset: false,
          label: "test field",
        },
      } satisfies Record<string, DataswornSource.AssetControlField>);
    });

    it("parses a card_flip control", () => {
      const md = `${base}

## Controls

* Test field (card_flip, is_impact: true, disables_asset: false)
`;
      const result = markdownAssetToDatasworn(md);
      expect(result.unwrap().controls).toEqual({
        test_field: {
          field_type: "card_flip",
          is_impact: true,
          disables_asset: false,
          label: "test field",
        },
      } satisfies Record<string, DataswornSource.AssetControlField>);
    });

    it("parses a condition meter with a checkbox subcontrol", () => {
      const md = `${base}

## Controls

* Test field (condition_meter, max: 5, value: 5)
  * Ouchy  (checkbox, is_impact: true)
`;
      const result = markdownAssetToDatasworn(md);
      expect(result.unwrap().controls).toEqual({
        test_field: {
          field_type: "condition_meter",
          min: 0,
          max: 5,
          value: 5,
          label: "test field",
          controls: {
            ouchy: {
              field_type: "checkbox",
              label: "ouchy",
              is_impact: true,
            },
          },
        },
      } satisfies Record<string, DataswornSource.AssetControlField>);
    });

    it("parses an option", () => {
      const md = `${base}

## Options

* Test field (text)
`;
      const result = markdownAssetToDatasworn(md);
      expect(result.unwrap().options).toEqual({
        test_field: {
          field_type: "text",
          label: "test field",
        },
      } satisfies Record<string, DataswornSource.AssetOptionField>);
    });

    it("doesn't care about the order of controls and options", () => {
      const options = `

## Options

* Test field (text)
`;
      const controls = `

## Controls

* Test control (condition_meter, max: 5, value: 5)
`;
      expect(
        markdownAssetToDatasworn(base + options + controls).unwrap(),
      ).toEqual(markdownAssetToDatasworn(base + controls + options).unwrap());
    });
  });
});
