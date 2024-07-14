import IronVaultPlugin from "index";
import { createNewIronVaultEntityFile } from "utils/obsidian";
import { IronVaultKind } from "../constants";
import { CampaignFile } from "./entity";
import { NewCampaignModal } from "./ui/new-campaign-modal";
import { normalizePath } from "obsidian";

export async function createNewCampaignCommand(plugin: IronVaultPlugin) {
  const campaignInfo = await NewCampaignModal.show(plugin);
  await createNewIronVaultEntityFile(
    plugin.app,
    campaignInfo.folder,
    campaignInfo.campaignName,
    IronVaultKind.Campaign,
    CampaignFile.generate({ name: campaignInfo.campaignName }),
    undefined,
    `Welcome to your new campaign! This is a campaign index file, which marks its folder as a campaign. Any journals or game entities inside this folder will use this campaign for any mechanics or commands. You can replace all this text with any details or notes you have about your campaign. As long as the file properties remain the same, you don't have to worry about the contents of this file.\n`,
  );
  const file = plugin.app.vault.getFileByPath(
    normalizePath(
      [campaignInfo.folder, campaignInfo.campaignName + ".md"].join("/"),
    ),
  );
  file && plugin.app.workspace.getLeaf(false).openFile(file);
}
