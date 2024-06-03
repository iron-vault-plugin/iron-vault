import { RollWrapper } from "model/rolls";

export type EntityDescriptor<T extends EntitySpec> = {
  label: string;
  nameGen?: (ent: EntityResults<T>) => string;
  spec: T;
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
export const ENTITIES: Record<string, EntityDescriptor<EntitySpec>> = {
  character: {
    label: "Character",
    nameGen: (ent) =>
      `${ent.givenName[0]?.simpleResult}${ent.callSign.length > 0 ? ' "' + ent.callSign[0].simpleResult + '"' : ""} ${ent.familyName[0]?.simpleResult}`,
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
  faction: {
    label: "Faction",
    nameGen: (ent) => ent.name[0]?.simpleResult,
    spec: {
      name: {
        id: "starforged/oracles/factions/name/template",
        firstLook: true,
      },
    },
  },

  creature: {
    label: "Creature",
    nameGen: (_ent) => "TBD",
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

  planet: {
    label: "Planet",
    nameGen: (ent) => ent.name[0]?.simpleResult,
    spec: {
      region: {
        id: "starforgedsupp/oracles/templates/region",
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
};
