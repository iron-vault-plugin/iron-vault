import { NoSuchOracleError } from "model/errors";
import { App, Editor } from "obsidian";
import ForgedPlugin from "../index";
import { Oracle, OracleRollableRow, RollContext } from "../model/oracle";
import { Roll, RollWrapper } from "../model/rolls";
import { OracleRoller } from "../oracles/roller";
import { CustomSuggestModal } from "../utils/suggest";
import {
  AttributeMechanism,
  EntityAttributeFieldSpec,
  EntityDescriptor,
  EntityModal,
  EntityResults,
  EntitySpec,
} from "./modal";

type OraclePromptOption =
  | { action: "pick"; row: OracleRollableRow }
  | { action: "roll" };

export async function promptOracleRow(
  app: App,
  oracle: Oracle,
  rollContext: RollContext,
  allowRandom: boolean,
): Promise<Roll> {
  let options: OraclePromptOption[] = allowRandom ? [{ action: "roll" }] : [];
  options = options.concat(
    oracle.rollableRows.map(
      (row): OraclePromptOption => ({ action: "pick", row }),
    ),
  );
  const selection: OraclePromptOption =
    await CustomSuggestModal.select<OraclePromptOption>(
      app,
      options,
      (option) => {
        switch (option.action) {
          case "pick":
            return option.row.result;
          case "roll":
            return "Roll on the table";
        }
      },
      undefined,
      `Choose an option from the ${oracle.name} table`,
    );

  switch (selection.action) {
    case "pick":
      return oracle.evaluate(rollContext, selection.row.range.min);
    case "roll":
      return oracle.roll(rollContext);
  }
}

export async function generateEntity(
  plugin: ForgedPlugin,
  entityDesc: EntityDescriptor<EntitySpec>,
): Promise<EntityResults<EntitySpec>> {
  const { datastore } = plugin;
  if (!datastore.ready) {
    throw new Error("data not ready");
  }
  const rollContext = new OracleRoller(datastore.oracles);
  const attributes = Object.entries(entityDesc.spec)
    .filter(
      (keyAndSpec): keyAndSpec is [string, EntityAttributeFieldSpec] =>
        (keyAndSpec[1] as EntityAttributeFieldSpec).definesAttribute !==
        undefined,
    )
    .sort(
      ([, spec1], [, spec2]) =>
        spec1.definesAttribute.order - spec2.definesAttribute.order,
    );

  const initialEntity: Partial<EntityResults<EntitySpec>> = {};
  for (const [key, spec] of attributes) {
    const oracle = rollContext.lookup(spec.id);
    if (!oracle) {
      throw new NoSuchOracleError(spec.id, `missing entity oracle for ${key}`);
    }
    const roll = await promptOracleRow(plugin.app, oracle, rollContext, true);
    initialEntity[key] = [new RollWrapper(oracle, rollContext, roll)];
  }
  return EntityModal.create({
    app: plugin.app,
    entityDesc,
    rollContext,
    initialEntity,
  });
}

const ENTITIES: Record<string, EntityDescriptor<EntitySpec>> = {
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
    nameGen: (ent) => "TBD",
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

export async function generateEntityCommand(
  plugin: ForgedPlugin,
  editor: Editor,
): Promise<void> {
  const [_key, entityDesc] = await CustomSuggestModal.select(
    plugin.app,
    Object.entries(ENTITIES),
    ([_key, { label }]) => label,
    undefined,
    "What kind of entity?",
  );
  const entity = await generateEntity(plugin, entityDesc);
  editor.replaceSelection(
    `> [!oracle] ${entityDesc.label}: ${entityDesc.nameGen ? entityDesc.nameGen(entity) : ""}\n${Object.entries(
      entity,
    )
      .flatMap(([slotKey, rolls]) => {
        if (rolls.length > 0) {
          const name = entityDesc.spec[slotKey].name ?? rolls[0].oracle.name;
          return [
            `> **${name}**: ${rolls.map((roll) => roll.simpleResult).join(", ")}\n`,
          ];
        } else {
          return [];
        }
      })
      .join("")}\n`,
  );
}
