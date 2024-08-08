export const STANDARD_PLAYSET_DEFNS = {
  classic: { name: "Ironsworn", lines: ["*:classic/**"] } as {
    name: string;
    lines: string[];
  },
  classic_delve: {
    name: "Ironsworn w/ Delve",
    lines: ["@include(classic)", "*:delve/**"],
  },
  starforged: {
    name: "Starforged",
    lines: ["*:starforged/**", "*:starforgedsupp/**"],
  },
  starforged__si_assets: {
    name: "Starforged w/ SI assets recommended for base game",
    lines: [
      "@include(starforged)",
      "asset:sundered_isles/** [starforged.recommended=true]",
    ],
  },

  sundered_isles__assets_all: {
    name: "Sundered Isles (all SF and SI assets)",
    lines: [
      "rules_package:starforged",
      "move:starforged/**",
      "move_category:starforged/**",
      // Sundered Isles p56 suggests creature oracles
      "oracle_rollable:starforged/creature/**",
      "*:sundered_isles/**",
      "*:sundered_isles_supp/**",
      "asset:starforged/** [sundered_isles.recommended=true]",
    ],
  },
  sundered_isles__assets_technological: {
    name: "Sundered Isles ('technological' assets)",
    lines: [
      "@include(sundered_isles__assets_all)",
      "!asset:starforged/** [core.supernatural=true]",
      "!asset:sundered_isles/** [core.supernatural=true]",
    ],
  },
  sundered_isles__assets_supernatural: {
    name: "Sundered Isles ('supernatural' assets)",
    lines: [
      "@include(sundered_isles__assets_all)",
      "!asset:starforged/** [core.technological=true]",
      "!asset:sundered_isles/** [core.technological=true]",
    ],
  },
  sundered_isles__assets_historical: {
    name: "Sundered Isles (no 'supernatural' or 'technological' assets)",
    lines: [
      "@include(sundered_isles__assets_all)",
      "!asset:starforged/** [core.technological=true]",
      "!asset:sundered_isles/** [core.technological=true]",
      "!asset:starforged/** [core.supernatural=true]",
      "!asset:sundered_isles/** [core.supernatural=true]",
    ],
  },
};

export function getStandardPlaysetDefinition(
  key: string,
): { name: string; lines: string[] } | undefined {
  if (key in STANDARD_PLAYSET_DEFNS) {
    return STANDARD_PLAYSET_DEFNS[key as keyof typeof STANDARD_PLAYSET_DEFNS];
  } else {
    return undefined;
  }
}
