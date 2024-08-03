import { createNewCharacter } from "characters/commands";
import IronVaultPlugin from "index";
import { generateTruthsForCampaign } from "truths/command";
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
    CampaignFile.generate({
      name: campaignInfo.campaignName,
      ironvault: {
        playset:
          campaignInfo.playsetOption == "custom"
            ? {
                type: "globs",
                lines: campaignInfo.customPlaysetDefn.split(/\r\n?|\n/g),
              }
            : { type: "registry", key: campaignInfo.playsetOption },
      },
    }),
    undefined,
    `Welcome to your new campaign! This is a campaign index file, which marks its folder as a campaign. Any journals or game entities inside this folder will use this campaign for any mechanics or commands. You can replace all this text with any details or notes you have about your campaign. As long as the file properties remain the same, you don't have to worry about the contents of this file.\n`,
  );

  if (campaignInfo.scaffold) {
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

    await plugin.app.fileManager.createNewMarkdownFile(
      await getExistingOrNewFolder(
        plugin.app,
        campaignInfo.folder + "/Journals",
      ),
      "Session 0.md",
      "This is the beginning of a great adventure...",
    );
    await getExistingOrNewFolder(
      plugin.app,
      campaignInfo.folder + "/Locations",
    );
    await getExistingOrNewFolder(plugin.app, campaignInfo.folder + "/Factions");
    await getExistingOrNewFolder(plugin.app, campaignInfo.folder + "/Lore");

    await plugin.app.workspace.getLeaf(false).openFile(file);

    const campaign = await plugin.campaignManager.awaitCampaignAvailability(
      file.path,
    );

    const campaignContext = plugin.campaignManager.campaignContextFor(campaign);
    await generateTruthsForCampaign(
      plugin,
      campaignContext,
      campaignInfo.folder,
      "Truths.md",
    );

    try {
      await createNewCharacter(plugin, campaignContext);
    } catch (e) {
      if (e == null) {
        // modal got closed. Let's just skip character creation and move on...
      }
    }
  }

  await plugin.app.workspace.getLeaf(false).openFile(file);
}
