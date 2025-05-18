import IronVaultPlugin from "index";
import { FactionInfluenceGridCreateModal } from "./grid-creation-modal";
import { createNewIronVaultEntityFile } from "utils/obsidian";
import { IronVaultKind } from "../constants";

export async function createFactionInfluenceGrid(plugin: IronVaultPlugin) {
  const input: {
    fileName: string;
    targetFolder: string;
  } = await new Promise((onAccept, onReject) => {
    new FactionInfluenceGridCreateModal(plugin, {}, onAccept, onReject).open();
  });

  const file = await createNewIronVaultEntityFile(
    plugin.app,
    input.targetFolder,
    input.fileName,
    IronVaultKind.FactionInfluenceGrid,
    {},
    undefined,
    `
| Dominant 1-30 | Established 31-45 | Established 46-60 |
|---|---|---|
| | | |
| Subsisting 61-70 | Subsisting 71-80 | Subsisting 81-90 |
| | | |
| Diminished 91-94 | Diminished 95-98 | Obscure 99-100 |
| | | |
`,
  );

  plugin.app.workspace.getLeaf(false).openFile(file);
}
