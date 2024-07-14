import IronVaultPlugin from "index";
import { createNewIronVaultEntityFile } from "utils/obsidian";
import { IronVaultKind } from "../constants";
import { CampaignFile } from "./entity";
import { NewCampaignModal } from "./ui/new-campaign-modal";

export async function createNewCampaignCommand(plugin: IronVaultPlugin) {
  const campaignInfo = await NewCampaignModal.show(plugin);
  await createNewIronVaultEntityFile(
    plugin.app,
    campaignInfo.folder,
    campaignInfo.campaignName,
    IronVaultKind.Campaign,
    CampaignFile.generate({ name: campaignInfo.campaignName }),
  );
}
