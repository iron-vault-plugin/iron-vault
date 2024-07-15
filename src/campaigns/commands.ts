import IronVaultPlugin from "index";
import {
  createNewIronVaultEntityFile,
  getExistingOrNewFolder,
} from "utils/obsidian";
import { IronVaultKind } from "../constants";
import { CampaignFile } from "./entity";
import { NewCampaignModal } from "./ui/new-campaign-modal";

/** Obsidian command to create a new campaign. */
export async function createNewCampaignCommand(plugin: IronVaultPlugin) {
  const campaignInfo = await NewCampaignModal.show(plugin);
  const file = await createNewIronVaultEntityFile(
    plugin.app,
    campaignInfo.folder,
    campaignInfo.campaignName,
    IronVaultKind.Campaign,
    CampaignFile.generate({ name: campaignInfo.campaignName }),
    undefined,
    `Welcome to your new campaign! This is a campaign index file, which marks its folder as a campaign. Any journals or game entities inside this folder will use this campaign for any mechanics or commands. You can replace all this text with any details or notes you have about your campaign. As long as the file properties remain the same, you don't have to worry about the contents of this file.\n`,
  );

  if (plugin.settings.defaultCharactersFolder) {
    await getExistingOrNewFolder(
      plugin.app,
      campaignInfo.folder + "/" + plugin.settings.defaultCharactersFolder,
    );
  }

  if (plugin.settings.defaultClockFolder) {
    await getExistingOrNewFolder(
      plugin.app,
      campaignInfo.folder + "/" + plugin.settings.defaultClockFolder,
    );
  }

  if (plugin.settings.defaultProgressTrackFolder) {
    await getExistingOrNewFolder(
      plugin.app,
      campaignInfo.folder + "/" + plugin.settings.defaultProgressTrackFolder,
    );
  }

  await plugin.app.workspace.getLeaf(false).openFile(file);
}
