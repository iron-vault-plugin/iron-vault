import { Datasworn } from "@datasworn/core";
import { RollWrapper } from "model/rolls";

export type EntityDescriptor<T extends EntitySpec> = {
  label: string;
  nameGen?: (ent: EntityResults<T>) => string;
  spec: T;

  /** Id of oracle collection that this entity applies to. */
  collectionId?: Datasworn.OracleCollectionId;
};

export enum AttributeMechanism {
  /** Snake case the result. (e.g., Creature Environment) */
  Snakecase = "Snakecase",
  /** Take the last segment of the id: link (e.g., Planet Class) */
  ParseId = "parse-id",
}

export type DefinesAttribute = {
  order: number;
  mechanism: AttributeMechanism;
};
export type EntitySpec = Record<string, EntityFieldSpec>;

export type EntityBaseFieldSpec = {
  /** Oracle ID. Can use templates with `{{asdf}}` */
  id: string;

  /** True if this should be rolled as part of first look. */
  firstLook?: boolean;

  /** Label to use. If null, will use oracle name. */
  name?: string;

  /** Conditions for including this asset */
  condition?: Array<Record<string, string>>;
};
export type EntityAttributeFieldSpec = EntityBaseFieldSpec & {
  definesAttribute: DefinesAttribute;
};

export type EntityFieldSpec = EntityBaseFieldSpec | EntityAttributeFieldSpec;

export function isEntityAttributeSpec(
  spec: EntityFieldSpec,
): spec is EntityAttributeFieldSpec {
  return (spec as EntityAttributeFieldSpec).definesAttribute != null;
}

export type EntityResults<T extends EntitySpec> = {
  [key in keyof T]: RollWrapper[];
};

// TODO: these should maybe be indexed just like everything into the DataIndexer so we can
// pull the appropriate ones for our active rulesets?
export const ENTITIES: Record<string, EntityDescriptor<EntitySpec>> = {
  sfCharacter: {
    collectionId: "oracle_collection:starforged/character",
    label: "NPC",
    nameGen: (ent) =>
      // NB(@zkat): We use smart quotes here because `"` is an invalid
      // character in Windows filenames and `'` looks like shit. They look
      // nice anyway.
      `${ent.givenName[0]?.simpleResult}${ent.callSign.length > 0 ? " “" + ent.callSign[0].simpleResult + "”" : ""} ${ent.familyName[0]?.simpleResult}`,
    spec: {
      givenName: {
        id: "oracle_rollable:starforged/character/name/given_name",
        firstLook: true,
      },
      callSign: {
        id: "oracle_rollable:starforged/character/name/callsign",
        firstLook: true,
      },
      familyName: {
        id: "oracle_rollable:starforged/character/name/family_name",
        firstLook: true,
      },
      firstLook: {
        id: "oracle_rollable:starforged/character/first_look",
        firstLook: true,
      },
      initialDisposition: {
        id: "oracle_rollable:starforged/character/initial_disposition",
        firstLook: true,
      },
      role: {
        id: "oracle_rollable:starforged/character/role",
        firstLook: false,
      },
      goal: {
        id: "oracle_rollable:starforged/character/goal",
        firstLook: false,
      },
      revealedAspect: {
        id: "oracle_rollable:starforged/character/revealed_aspect",
        firstLook: false,
      },
    },
  },

  sfFaction: {
    label: "Faction",
    collectionId: "oracle_collection:starforged/faction",
    nameGen: (ent) => ent.name[0]?.simpleResult,
    spec: {
      factionType: {
        id: "oracle_rollable:starforged/faction/type",
        firstLook: true,
        definesAttribute: {
          order: 1,
          mechanism: AttributeMechanism.ParseId,
        },
      },
      name: {
        id: "oracle_rollable:starforged/faction/name/template",
        firstLook: true,
      },
      dominionType: {
        id: "oracle_rollable:starforged/faction/dominion",
        firstLook: true,
        condition: [{ factionType: "dominion" }],
      },
      dominionLeadership: {
        id: "oracle_rollable:starforged/faction/dominion_leadership",
        firstLook: true,
        condition: [{ factionType: "dominion" }],
      },
      guildType: {
        id: "oracle_rollable:starforged/faction/guild",
        firstLook: true,
        condition: [{ factionType: "guild" }],
      },
      fringeGroupType: {
        id: "oracle_rollable:starforged/faction/fringe_group",
        firstLook: true,
        condition: [{ factionType: "fringe_group" }],
      },
      factionProjects: {
        id: "oracle_rollable:starforged/faction/projects",
      },
      factionQuirks: {
        id: "oracle_rollable:starforged/faction/quirks",
      },
      factionRumors: {
        id: "oracle_rollable:starforged/faction/rumors",
      },
    },
  },

  sfCreature: {
    label: "Creature",
    collectionId: "oracle_collection:starforged/creature",
    // TODO(@cwegrzyn): should we generate a name based on other aspects?
    // nameGen: (_ent) => "TBD",
    spec: {
      environment: {
        id: "oracle_rollable:starforged/creature/environment",
        firstLook: true,
        definesAttribute: {
          order: 1,
          mechanism: AttributeMechanism.Snakecase,
        },
      },
      basicForm: {
        id: "oracle_rollable:starforged/creature/basic_form/{{environment}}",
        firstLook: true,
        name: "Basic form",
      },
      scale: {
        id: "oracle_rollable:starforged/creature/scale",
        firstLook: true,
      },
      firstLook: {
        id: "oracle_rollable:starforged/creature/first_look",
        firstLook: true,
      },
      encounteredBehavior: {
        id: "oracle_rollable:starforged/creature/encountered_behavior",
      },
      revealedAspect: {
        id: "oracle_rollable:starforged/creature/revealed_aspect",
      },
    },
  },
  sfPlanet: {
    label: "Planet",
    nameGen: (ent) => ent.name[0]?.simpleResult,
    collectionId: "oracle_collection:starforged/planet",
    spec: {
      region: {
        id: "oracle_rollable:starforgedsupp/core/region",
        firstLook: true,
        definesAttribute: {
          order: 1,
          mechanism: AttributeMechanism.Snakecase,
        },
      },
      class: {
        id: "oracle_rollable:starforged/planet/class",
        firstLook: true,
        definesAttribute: {
          order: 2,
          mechanism: AttributeMechanism.ParseId,
        },
      },
      name: {
        id: "oracle_rollable:starforged/planet/{{class}}/name",
        firstLook: true,
        name: "Planet name",
      },
      atmosphere: {
        id: "oracle_rollable:starforged/planet/{{class}}/atmosphere",
        firstLook: true,
      },
      observed_from_space: {
        id: "oracle_rollable:starforged/planet/{{class}}/observed_from_space",
        firstLook: true,
      },
      settlements: {
        id: "oracle_rollable:starforged/planet/{{class}}/settlements/{{region}}",
        firstLook: true,
        name: "Settlements",
      },
    },
  },
  sfSettlement: {
    label: "Settlement",
    nameGen: (ent) => {
      if (ent.name_tags && ent.name_tags.length > 0) {
        return `${ent.name[0]?.simpleResult} ${ent.name_tags[0].simpleResult}`;
      }
      return ent.name[0]?.simpleResult;
    },
    collectionId: "oracle_collection:starforged/settlement",
    spec: {
      region: {
        id: "oracle_rollable:starforgedsupp/core/region",
        firstLook: true,
        definesAttribute: {
          order: 1,
          mechanism: AttributeMechanism.Snakecase,
        },
      },
      name: {
        id: "oracle_rollable:starforged/settlement/name",
        firstLook: true,
      },
      name_tags: {
        name: "Name Suffix",
        id: "oracle_rollable:starforged/settlement/name_tags",
      },
      location: {
        id: "oracle_rollable:starforged/settlement/location",
        firstLook: true,
      },
      population: {
        name: "Population",
        id: "oracle_rollable:starforged/settlement/population/{{region}}",
        firstLook: true,
      },
      first_look: {
        id: "oracle_rollable:starforged/settlement/first_look",
        firstLook: true,
      },
      initial_contact: {
        id: "oracle_rollable:starforged/settlement/initial_contact",
      },
      authority: {
        id: "oracle_rollable:starforged/settlement/authority",
      },
      projects: {
        name: "Settlement Projects",
        id: "oracle_rollable:starforged/settlement/projects",
      },
      trouble: {
        name: "Settlement Trouble",
        id: "oracle_rollable:starforged/settlement/trouble",
      },
    },
  },
  isIronlander: {
    collectionId: "oracle_collection:classic/character",
    label: "Ironlander",
    nameGen: (ent) => ent.nameA[0]?.simpleResult ?? ent.nameB[0]?.simpleResult,
    spec: {
      nameA: {
        id: "oracle_rollable:classic/name/ironlander/a",
        name: "Name table A",
        firstLook: true,
      },
      nameB: {
        id: "oracle_rollable:classic/name/ironlander/b",
        name: "Name table B",
        firstLook: false,
      },
      role: {
        id: "oracle_rollable:classic/character/role",
        firstLook: true,
        name: "Character role",
      },
      descriptor: {
        id: "oracle_rollable:classic/character/descriptor",
        firstLook: true,
        name: "Character descriptor",
      },
      goal: {
        id: "oracle_rollable:classic/character/goal",
        firstLook: false,
        name: "Character goal",
      },
    },
  },
  siIsland: {
    label: "Island",
    nameGen: (ent) => ent.name[0]?.simpleResult,
    collectionId: "oracle_collection:sundered_isles/island",
    spec: {
      region: {
        id: "oracle_rollable:sundered_isles_supp/core/region",
        firstLook: true,
        definesAttribute: {
          order: 1,
          mechanism: AttributeMechanism.Snakecase,
        },
      },
      name: {
        id: "oracle_rollable:sundered_isles/island/name",
        firstLook: true,
      },
      size: {
        id: "oracle_rollable:sundered_isles/island/landscape/size",
        firstLook: true,
      },
      terrain: {
        id: "oracle_rollable:sundered_isles/island/landscape/terrain",
        firstLook: true,
      },
      vitality: {
        id: "oracle_rollable:sundered_isles/island/landscape/vitality/{{region}}",
        firstLook: true,
        name: "Vitality",
      },
      nearby_islands: {
        id: "oracle_rollable:sundered_isles/island/nearby_islands/{{region}}",
        firstLook: true,
        name: "Nearby islands",
      },
      coastline_aspects: {
        id: "oracle_rollable:sundered_isles/island/coastline_aspects",
      },
      offshore_observations: {
        id: "oracle_rollable:sundered_isles/island/offshore_observations",
      },
      visible_habitation: {
        id: "oracle_rollable:sundered_isles/island/visible_habitation/{{region}}",
        name: "Visible habitation",
      },
    },
  },
  siRuin: {
    label: "Ruin",
    collectionId: "oracle_collection:sundered_isles/ruin",
    spec: {
      location: {
        id: "oracle_rollable:sundered_isles/ruin/location",
        firstLook: true,
        definesAttribute: {
          order: 1,
          mechanism: AttributeMechanism.Snakecase,
        },
      },
      condition: {
        id: "oracle_rollable:sundered_isles/ruin/condition",
        firstLook: true,
      },
      scope: {
        id: "oracle_rollable:sundered_isles/ruin/scope",
        firstLook: true,
      },
      first_look: {
        id: "oracle_rollable:sundered_isles/ruin/first_look",
        firstLook: true,
      },
      mystery: {
        id: "oracle_rollable:sundered_isles/ruin/mystery",
      },
      cipher: {
        id: "oracle_rollable:sundered_isles/ruin/cipher",
      },
      feature: {
        id: "oracle_rollable:sundered_isles/ruin/feature",
      },
      peril: {
        id: "oracle_rollable:sundered_isles/ruin/peril",
      },
      opportunity: {
        id: "oracle_rollable:sundered_isles/ruin/opportunity",
      },
    },
  },
  siCharacter: {
    label: "NPC",
    collectionId: "oracle_collection:sundered_isles/character",
    nameGen: (ent) =>
      // NB(@zkat): We use smart quotes here because `"` is an invalid
      // character in Windows filenames and `'` looks like shit. They look
      // nice anyway.
      `${ent.given_name[0]?.simpleResult}${ent.moniker.length > 0 ? " “" + ent.moniker[0].simpleResult + "”" : ""} ${ent.family_name[0]?.simpleResult}`,
    spec: {
      given_name: {
        id: "oracle_rollable:sundered_isles/character/name/given_name",
        firstLook: true,
      },
      moniker: {
        id: "oracle_rollable:sundered_isles/character/name/moniker",
        firstLook: true,
      },
      family_name: {
        id: "oracle_rollable:sundered_isles/character/name/family_name",
        firstLook: true,
      },
      first_look: {
        id: "oracle_rollable:sundered_isles/character/first_look",
        firstLook: true,
        name: "First look",
      },
      disposition: {
        id: "oracle_rollable:sundered_isles/character/initial_disposition",
        firstLook: true,
      },
      roles: {
        id: "oracle_rollable:sundered_isles/character/roles",
        firstLook: true,
        definesAttribute: {
          order: 1,
          mechanism: AttributeMechanism.ParseId,
        },
      },
      role_details: {
        id: "oracle_rollable:sundered_isles/character/role_details/{{roles}}",
      },
      trademark_accessories: {
        id: "oracle_rollable:sundered_isles/character/trademark_accessories",
      },
      trademark_weapons: {
        id: "oracle_rollable:sundered_isles/character/trademark_weapons",
      },
      details: {
        id: "oracle_rollable:sundered_isles/character/details",
      },
      goals: {
        id: "oracle_rollable:sundered_isles/character/goals",
      },
    },
  },
  siSettlement: {
    label: "Settlement",
    collectionId: "oracle_collection:sundered_isles/settlement",
    nameGen: (ent) => ent.name[0]?.simpleResult,
    spec: {
      region: {
        id: "oracle_rollable:sundered_isles_supp/core/region",
        firstLook: true,
        definesAttribute: {
          order: 1,
          mechanism: AttributeMechanism.Snakecase,
        },
      },
      location: {
        id: "oracle_rollable:sundered_isles/settlement/location",
        firstLook: true,
        definesAttribute: {
          order: 2,
          mechanism: AttributeMechanism.Snakecase,
        },
      },
      size: {
        name: "Size",
        id: "oracle_rollable:sundered_isles/settlement/size/{{region}}",
        firstLook: true,
      },
      name: {
        firstLook: true,
        id: "oracle_rollable:sundered_isles/settlement/name",
      },
      aesthetics: {
        id: "oracle_rollable:sundered_isles/settlement/aesthetics",
        firstLook: true,
      },
      first_look: {
        id: "oracle_rollable:sundered_isles/settlement/first_look",
        firstLook: true,
      },
      controlling_faction: {
        name: "Controlling faction",
        id: "oracle_rollable:sundered_isles/settlement/identity/controlling_faction/{{region}}",
      },
      disposition: {
        id: "oracle_rollable:sundered_isles/settlement/identity/disposition",
      },
      authority: {
        id: "oracle_rollable:sundered_isles/settlement/identity/authority",
      },
      focus: {
        name: "Focus",
        id: "oracle_rollable:sundered_isles/settlement/identity/focus/{{location}}",
      },
      details: {
        id: "oracle_rollable:sundered_isles/settlement/details",
      },
    },
  },
  siSociety: {
    label: "Faction: Society",
    collectionId: "oracle_collection:sundered_isles/faction/society",
    nameGen: (ent) =>
      `The ${ent.name_culture[0]?.simpleResult ? ent.name_culture[0]?.simpleResult + " " : ""}${ent.name_theme_aspect[0]?.simpleResult ? ent.name_theme_aspect[0]?.simpleResult + " " : ""}${ent.name_theme_persona[0]?.simpleResult ? ent.name_theme_persona[0]?.simpleResult + " " : ""}${ent.name_identity[0]?.simpleResult ?? ""}`,
    spec: {
      name_culture: {
        id: "oracle_rollable:sundered_isles/faction/name/culture",
      },
      name_identity: {
        id: "oracle_rollable:sundered_isles/faction/name/identity_society",
      },
      name_theme_type: {
        id: "oracle_rollable:sundered_isles/faction/name/themes/type",
        definesAttribute: {
          order: 1,
          mechanism: AttributeMechanism.ParseId,
        },
      },
      name_theme_aspect: {
        id: "oracle_rollable:sundered_isles/faction/name/themes/{{name_theme_type}}/aspect",
        name: "Name: Aspect",
      },
      name_theme_persona: {
        id: "oracle_rollable:sundered_isles/faction/name/themes/{{name_theme_type}}/persona",
        name: "Name: Persona",
      },
      chronicles: {
        id: "oracle_rollable:sundered_isles/faction/society/chronicles",
      },
      overseers: {
        id: "oracle_rollable:sundered_isles/faction/society/overseers",
      },
      touchstones: {
        id: "oracle_rollable:sundered_isles/faction/society/touchstones",
      },
      cursed_aspects: {
        id: "oracle_rollable:sundered_isles/faction/cursed/aspects",
      },
    },
  },
  siOrganization: {
    label: "Faction: Organization",
    collectionId: "oracle_collection:sundered_isles/faction/organization",
    nameGen: (ent) =>
      `The ${ent.name_culture[0]?.simpleResult ? ent.name_culture[0]?.simpleResult + " " : ""}${ent.name_theme_aspect[0]?.simpleResult ? ent.name_theme_aspect[0]?.simpleResult + " " : ""}${ent.name_theme_persona[0]?.simpleResult ? ent.name_theme_persona[0]?.simpleResult + " " : ""}${ent.name_identity[0]?.simpleResult ?? ""}`,
    spec: {
      name_culture: {
        id: "oracle_rollable:sundered_isles/faction/name/culture",
      },
      name_identity: {
        id: "oracle_rollable:sundered_isles/faction/name/identity_organization",
      },
      name_theme_type: {
        id: "oracle_rollable:sundered_isles/faction/name/themes/type",
        definesAttribute: {
          order: 1,
          mechanism: AttributeMechanism.ParseId,
        },
      },
      name_theme_aspect: {
        id: "oracle_rollable:sundered_isles/faction/name/themes/{{name_theme_type}}/aspect",
        name: "Name: Aspect",
      },
      name_theme_persona: {
        id: "oracle_rollable:sundered_isles/faction/name/themes/{{name_theme_type}}/persona",
        name: "Name: Persona",
      },
      type: {
        id: "oracle_rollable:sundered_isles/faction/organization/type",
      },
      methods: {
        id: "oracle_rollable:sundered_isles/faction/organization/methods",
      },
      secrets: {
        id: "oracle_rollable:sundered_isles/faction/organization/secrets",
      },
      cursed_aspects: {
        id: "oracle_rollable:sundered_isles/faction/cursed/aspects",
      },
    },
  },
  siEmpire: {
    label: "Faction: Empire",
    collectionId: "oracle_collection:sundered_isles/faction/empire",
    nameGen: (ent) =>
      `The ${ent.name_culture[0]?.simpleResult ? ent.name_culture[0]?.simpleResult + " " : ""}${ent.name_theme_aspect[0]?.simpleResult ? ent.name_theme_aspect[0]?.simpleResult + " " : ""}${ent.name_theme_persona[0]?.simpleResult ? ent.name_theme_persona[0]?.simpleResult + " " : ""}${ent.name_identity[0]?.simpleResult ?? ""}`,
    spec: {
      name_culture: {
        id: "oracle_rollable:sundered_isles/faction/name/culture",
      },
      name_identity: {
        id: "oracle_rollable:sundered_isles/faction/name/identity_empire",
      },
      name_theme_type: {
        id: "oracle_rollable:sundered_isles/faction/name/themes/type",
        definesAttribute: {
          order: 1,
          mechanism: AttributeMechanism.ParseId,
        },
      },
      name_theme_aspect: {
        id: "oracle_rollable:sundered_isles/faction/name/themes/{{name_theme_type}}/aspect",
        name: "Name: Aspect",
      },
      name_theme_persona: {
        id: "oracle_rollable:sundered_isles/faction/name/themes/{{name_theme_type}}/persona",
        name: "Name: Persona",
      },
      leadership: {
        id: "oracle_rollable:sundered_isles/faction/empire/leadership",
      },
      tactics: {
        id: "oracle_rollable:sundered_isles/faction/empire/tactics",
      },
      vulnerabilities: {
        id: "oracle_rollable:sundered_isles/faction/empire/vulnerabilities",
      },
      cursed_aspects: {
        id: "oracle_rollable:sundered_isles/faction/cursed/aspects",
      },
    },
  },
  siCursed: {
    label: "Faction: Cursed Faction",
    collectionId: "oracle_collection:sundered_isles/faction/cursed",
    nameGen: (ent) =>
      `The ${ent.name_culture[0]?.simpleResult ? ent.name_culture[0]?.simpleResult + " " : ""}${ent.name_theme_aspect[0]?.simpleResult ? ent.name_theme_aspect[0]?.simpleResult + " " : ""}${ent.name_theme_persona[0]?.simpleResult ? ent.name_theme_persona[0]?.simpleResult + " " : ""}`,
    spec: {
      name_culture: {
        id: "oracle_rollable:sundered_isles/faction/name/culture",
      },
      name_theme_type: {
        id: "oracle_rollable:sundered_isles/faction/name/themes/type",
        definesAttribute: {
          order: 1,
          mechanism: AttributeMechanism.ParseId,
        },
      },
      name_theme_aspect: {
        id: "oracle_rollable:sundered_isles/faction/name/themes/{{name_theme_type}}/aspect",
        name: "Name: Aspect",
      },
      name_theme_persona: {
        id: "oracle_rollable:sundered_isles/faction/name/themes/{{name_theme_type}}/persona",
        name: "Name: Persona",
      },
      role: {
        id: "oracle_rollable:sundered_isles/faction/cursed/role",
      },
      aspects: {
        id: "oracle_rollable:sundered_isles/faction/cursed/aspects",
      },
    },
  },
};
