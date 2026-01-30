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
        customContentFolder: campaignInfo.campaignContentFolder,
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
    `Welcome to your new campaign! This is a campaign index file, which marks its folder as a campaign. Any journals or game entities inside this folder will use this campaign for any mechanics or commands. You can replace all this text with any details or notes you have about your campaign. As long as the file properties remain the same, you don't have to worry about the contents of this file.

## Included Datasets

Iron Vault includes data from various official and community rulesets and expansions. This data has been generously made available for free to community tools by their respective authors, allowing you to use Iron Vault without paying. You can control which datasets are activated in the playset settings page for your campaign.

We ask that, if you haven't already, you consider buying the source books for these rulesets and expansions when you decide to play with them in your campaign, in order to support the game creators that make this experience possible:

* [Ironsworn](https://tomkinpress.com/collections/products-for-ironsworn) ([CC-BY-4.0](https://creativecommons.org/licenses/by/4.0))
* [Ironsworn: Delve](https://tomkinpress.com/collections/products-for-ironsworn-delve) ([CC-BY-4.0](https://creativecommons.org/licenses/by/4.0))
* [Ironsworn: Starforged](https://tomkinpress.com/collections/products-for-ironsworn-starforged) ([CC-BY-4.0](https://creativecommons.org/licenses/by/4.0))
* [Sundered Isles](https://tomkinpress.com/collections/products-for-sundered-isles) ([CC-BY-NC-SA-4.0](https://creativecommons.org/licenses/by-nc-sa/4.0))
* [Ancient Wonders](https://ludicpen.itch.io/ancient-wonders) ([Print-on-demand](https://www.drivethrurpg.com/product/505365)) ([CC-BY-NC-SA-4.0](https://creativecommons.org/licenses/by-nc-sa/4.0))
* [Fe-Runners](https://zombiecraig.itch.io/fe-runners) ([CC-BY-NC-SA-4.0](https://creativecommons.org/licenses/by-nc-sa/4.0))
* [Ironsmith](https://playeveryrole.com/ironsmith/) ([CC-BY-4.0](https://creativecommons.org/licenses/by/4.0))
* [Starsmith](https://playeveryrole.com/starsmith-products/) ([CC-BY-4.0](https://creativecommons.org/licenses/by/4.0))
`,
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
