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
    collectionId: "starforged/collections/oracles/characters",
    label: "NPC",
    nameGen: (ent) =>
      // NB(@zkat): We use smart quotes here because `"` is an invalid
      // character in Windows filenames and `'` looks like shit. They look
      // nice anyway.
      `${ent.givenName[0]?.simpleResult}${ent.callSign.length > 0 ? " “" + ent.callSign[0].simpleResult + "”" : ""} ${ent.familyName[0]?.simpleResult}`,
    spec: {
      givenName: {
        id: "starforged/oracles/characters/name/given",
        firstLook: true,
      },
      callSign: {
        id: "starforged/oracles/characters/name/callsign",
        firstLook: true,
      },
      familyName: {
        id: "starforged/oracles/characters/name/family_name",
        firstLook: true,
      },
      firstLook: {
        id: "starforged/oracles/characters/first_look",
        firstLook: true,
      },
      initialDisposition: {
        id: "starforged/oracles/characters/initial_disposition",
        firstLook: true,
      },
      role: {
        id: "starforged/oracles/characters/role",
        firstLook: false,
      },
      goal: {
        id: "starforged/oracles/characters/goal",
        firstLook: false,
      },
      revealedAspect: {
        id: "starforged/oracles/characters/revealed_aspect",
        firstLook: false,
      },
    },
  },

  sfFaction: {
    label: "Faction",
    collectionId: "starforged/collections/oracles/factions",
    nameGen: (ent) => ent.name[0]?.simpleResult,
    spec: {
      factionType: {
        id: "starforged/oracles/factions/type",
        firstLook: true,
        definesAttribute: {
          order: 1,
          mechanism: AttributeMechanism.ParseId,
        },
      },
      name: {
        id: "starforged/oracles/factions/name/template",
        firstLook: true,
      },
      dominionType: {
        id: "starforged/oracles/factions/dominion",
        firstLook: true,
        condition: [{ factionType: "dominion" }],
      },
      dominionLeadership: {
        id: "starforged/oracles/factions/dominion_leadership",
        firstLook: true,
        condition: [{ factionType: "dominion" }],
      },
      guildType: {
        id: "starforged/oracles/factions/guild",
        firstLook: true,
        condition: [{ factionType: "guild" }],
      },
      fringeGroupType: {
        id: "starforged/oracles/factions/fringe_group",
        firstLook: true,
        condition: [{ factionType: "fringe_group" }],
      },
      factionProjects: {
        id: "starforged/oracles/factions/projects",
      },
      factionQuirks: {
        id: "starforged/oracles/factions/quirks",
      },
      factionRumors: {
        id: "starforged/oracles/factions/rumors",
      },
    },
  },

  sfCreature: {
    label: "Creature",
    collectionId: "starforged/collections/oracles/creatures",
    // TODO(@cwegrzyn): should we generate a name based on other aspects?
    // nameGen: (_ent) => "TBD",
    spec: {
      environment: {
        id: "starforged/oracles/creatures/environment",
        firstLook: true,
        definesAttribute: {
          order: 1,
          mechanism: AttributeMechanism.Snakecase,
        },
      },
      basicForm: {
        id: "starforged/oracles/creatures/basic_form/{{environment}}",
        firstLook: true,
        name: "Basic Form",
      },
      scale: {
        id: "starforged/oracles/creatures/scale",
        firstLook: true,
      },
      firstLook: {
        id: "starforged/oracles/creatures/first_look",
        firstLook: true,
      },
      encounteredBehavior: {
        id: "starforged/oracles/creatures/encountered_behavior",
      },
      revealedAspect: {
        id: "starforged/oracles/creatures/revealed_aspect",
      },
    },
  },

  sfSettlement: {
    label: "Settlement",
    nameGen: (ent) => ent.name[0]?.simpleResult,
    collectionId: "starforged/collections/oracles/settlements",
    spec: {
      region: {
        id: "starforgedsupp/oracles/core/region",
        firstLook: true,
        definesAttribute: {
          order: 1,
          mechanism: AttributeMechanism.Snakecase,
        },
      },
      name: {
        id: "starforged/oracles/settlements/name",
        firstLook: true,
      },
      location: {
        id: "starforged/oracles/settlements/location",
        firstLook: true,
      },
      population: {
        id: "starforged/oracles/settlements/population/{{region}}",
        firstLook: true,
        name: "Population",
      },
      authority: {
        id: "starforged/oracles/settlements/authority",
        firstLook: true,
      },
      project: {
        id: "starforged/oracles/settlements/projects",
        firstLook: true,
      },
      firstLook: {
        id: "starforged/oracles/settlements/first_look",
        // lol this is ironic, but that's what the rulebook says
        firstLook: false,
        name: "First Look",
      },
      initialContact: {
        id: "starforged/oracles/settlements/initial_contact",
        firstLook: false,
        name: "Initial Contact",
      },
      trouble: {
        id: "starforged/oracles/settlements/trouble",
        firstLook: false,
      },
    },
  },

  sfPlanet: {
    label: "Planet",
    nameGen: (ent) => ent.name[0]?.simpleResult,
    collectionId: "starforged/collections/oracles/planets",
    spec: {
      region: {
        id: "starforgedsupp/oracles/core/region",
        firstLook: true,
        definesAttribute: {
          order: 1,
          mechanism: AttributeMechanism.Snakecase,
        },
      },
      class: {
        id: "starforged/oracles/planets/class",
        firstLook: true,
        definesAttribute: {
          order: 2,
          mechanism: AttributeMechanism.ParseId,
        },
      },
      name: {
        id: "starforged/oracles/planets/{{class}}/name",
        firstLook: true,
        name: "Planet Name",
      },
      atmosphere: {
        id: "starforged/oracles/planets/{{class}}/atmosphere",
        firstLook: true,
      },
      observed_from_space: {
        id: "starforged/oracles/planets/{{class}}/observed_from_space",
        firstLook: true,
      },
      settlements: {
        id: "starforged/oracles/planets/{{class}}/settlements/{{region}}",
        firstLook: true,
        name: "Settlements",
      },
    },
  },
  isIronlander: {
    collectionId: "classic/collections/oracles/character",
    label: "Ironlander",
    nameGen: (ent) => ent.nameA[0]?.simpleResult ?? ent.nameB[0]?.simpleResult,
    spec: {
      nameA: {
        id: "classic/oracles/name/ironlander/a",
        name: "Name Table A",
        firstLook: true,
      },
      nameB: {
        id: "classic/oracles/name/ironlander/b",
        name: "Name Table B",
        firstLook: false,
      },
      role: {
        id: "classic/oracles/character/role",
        firstLook: true,
        name: "Character Role",
      },
      descriptor: {
        id: "classic/oracles/character/descriptor",
        firstLook: true,
        name: "Character Descriptor",
      },
      goal: {
        id: "classic/oracles/character/goal",
        firstLook: false,
        name: "Character Goal",
      },
    },
  },
};
