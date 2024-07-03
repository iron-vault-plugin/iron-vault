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

  sfSettlement: {
    label: "Settlement",
    nameGen: (ent) => ent.name[0]?.simpleResult,
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
      location: {
        id: "oracle_rollable:starforged/settlement/location",
        firstLook: true,
      },
      population: {
        id: "oracle_rollable:starforged/settlement/population/{{region}}",
        firstLook: true,
        name: "Population",
      },
      authority: {
        id: "oracle_rollable:starforged/settlement/authority",
        firstLook: true,
      },
      project: {
        id: "oracle_rollable:starforged/settlement/projects",
        firstLook: true,
      },
      firstLook: {
        id: "oracle_rollable:starforged/settlement/first_look",
        // lol this is ironic, but that's what the rulebook says
        firstLook: false,
        name: "First look",
      },
      initialContact: {
        id: "oracle_rollable:starforged/settlement/initial_contact",
        firstLook: false,
        name: "Initial contact",
      },
      trouble: {
        id: "oracle_rollable:starforged/settlement/trouble",
        firstLook: false,
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
};
