export const STANDARD_PLAYSET_DEFNS: Record<
  string,
  { name: string; lines: string[] }
> = {
  classic: { name: "Ironsworn", lines: ["*:classic/**"] },
  classic_delve: {
    name: "Ironsworn w/ Delve",
    lines: ["@include(classic)", "*:delve/**"],
  },
  starforged: {
    name: "Starforged",
    lines: ["*:starforged/**", "*:starforgedsupp/**"],
  },

  sundered_isles__sf_assets_all: {
    name: "Sundered Isles all (recommended SF assets)",
    lines: [
      "@include(sundered_isles_base)",
      "asset:starforged/** [sundered_isles.recommended=true]",
    ],
  },
  sundered_isles__sf_assets_technological: {
    name: "Sundered Isles (recommended non-supernatural SF assets)",
    lines: [
      "@include(sundered_isles_base)",
      // Include all recommended ...
      "asset:starforged/** [sundered_isles.recommended=true]",
      // ... but reject those tagged as supernatural
      "!asset:starforged/** [sundered_isles.recommended=true&core.supernatural=true]",
    ],
  },
  sundered_isles__sf_assets_supernatural: {
    name: "Sundered Isles\n(recommended non-technological SF assets)",
    lines: [
      "@include(sundered_isles_base)",
      // Include all recommended ...
      "asset:starforged/** [sundered_isles.recommended=true]",
      // ... but reject those tagged as technological
      "!asset:starforged/** [sundered_isles.recommended=true&core.technological=true]",
    ],
  },
  sundered_isles__sf_assets_historical: {
    name: 'Sundered Isles (recommended "historical" SF assets)',
    lines: [
      "@include(sundered_isles_base)",
      // Include all recommended ...
      "asset:starforged/** [sundered_isles.recommended=true]",
      // ... but reject those tagged as technological or supernatural
      "!asset:starforged/** [sundered_isles.recommended=true&core.technological=true]",
      "!asset:starforged/** [sundered_isles.recommended=true&core.supernatural=true]",
    ],
  },
  sundered_isles_base: {
    name: "Sundered Isles Base (no Starforged Assets)",
    lines: [
      "rules_package:starforged",
      "move:starforged/**",
      "move_category:starforged/**",
      // Sundered Isles p56 suggests creature oracles
      "oracle_rollable:starforged/creature/**",
      "*:sundered_isles/**",
      "*:sundered_isles_supp/**",
    ],
  },
};
