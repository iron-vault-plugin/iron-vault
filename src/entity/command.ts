import { Editor } from "obsidian";
import { CustomSuggestModal } from "utils/suggest";
import ForgedPlugin from "../index";
import { OracleRoller } from "../oracles/roller";
import {
  EntityDescriptor,
  EntityModal,
  EntityResults,
  EntitySpec,
} from "./modal";

export async function generateEntity<T extends EntitySpec>(
  plugin: ForgedPlugin,
  entityDesc: EntityDescriptor<T>,
): Promise<EntityResults<T>> {
  const { datastore } = plugin;
  if (!datastore.ready) {
    throw new Error("data not ready");
  }
  const rollContext = new OracleRoller(datastore.oracles);
  return EntityModal.create({ app: plugin.app, entityDesc, rollContext });
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
      .flatMap(([_key, rolls]) => {
        if (rolls.length > 0) {
          const name = rolls[0].oracle.name;
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
