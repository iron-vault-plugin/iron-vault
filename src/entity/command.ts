import { Editor } from "obsidian";
import ForgedPlugin from "../index";
import { OracleRoller } from "../oracles/roller";
import { EntityModal } from "./modal";

export async function generateEntityCommand(
  plugin: ForgedPlugin,
  editor: Editor,
): Promise<void> {
  const { datastore } = plugin;
  if (!datastore.ready) {
    console.warn("data not ready");
    return;
  }
  const rollContext = new OracleRoller(datastore.oracles);
  const character = {
    firstLook: {
      id: "starforged/oracles/characters/first_look",
    },
    initialDisposition: {
      id: "starforged/oracles/characters/initial_disposition",
    },
  };
  new EntityModal(plugin.app, character, rollContext).open();
}
