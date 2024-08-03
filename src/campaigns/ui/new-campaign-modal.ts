import { PlaysetConfig } from "campaigns/playsets/config";
import IronVaultPlugin from "index";
import {
  ButtonComponent,
  DropdownComponent,
  Modal,
  normalizePath,
  Setting,
  TextComponent,
  TFile,
  TFolder,
} from "obsidian";
import { FolderTextSuggest } from "utils/ui/settings/folder";
import { PlaysetEditor } from "./playset-editor";

export type NewCampaignInfo = {
  campaignName: string;
  folder: string;
  scaffold: boolean;
  playsetOption: string;
  customPlaysetDefn: string;
};

export class NewCampaignModal extends Modal {
  campaignInfo: NewCampaignInfo = {
    campaignName: "",
    folder: "/",
    scaffold: true,
    playsetOption: "starforged",
    customPlaysetDefn: "",
  };

  static show(plugin: IronVaultPlugin): Promise<NewCampaignInfo> {
    return new Promise((resolve, reject) => {
      try {
        new NewCampaignModal(plugin, resolve, reject).open();
      } catch (e) {
        reject(e);
      }
    });
  }

  constructor(
    readonly plugin: IronVaultPlugin,
    private readonly resolve: (results: NewCampaignInfo) => unknown,
    private readonly reject: (e: Error) => unknown,
  ) {
    super(plugin.app);
  }

  onOpen(): void {
    const { contentEl } = this;

    const validate = () => {
      let valid: boolean = true;

      valid &&= (this.campaignInfo.campaignName ?? "").length > 0;

      // If the playset option is custom, we need a valid non-empty, playset config.
      if (this.campaignInfo.playsetOption == "custom") {
        if (this.campaignInfo.customPlaysetDefn.trim()) {
          try {
            PlaysetConfig.parseFile(this.campaignInfo.customPlaysetDefn);
          } catch (e) {
            valid = false;
          }
        } else {
          valid = false;
        }
      }

      const existing = this.app.vault.getAbstractFileByPath(
        this.campaignInfo.folder,
      );
      if (!existing) {
        resultSetting.setDesc(
          `Campaign will be created in new folder '${this.campaignInfo.folder}'.`,
        );
      } else if (existing instanceof TFolder) {
        resultSetting.setDesc(
          `Campaign will be created in existing folder '${this.campaignInfo.folder}'.`,
        );
      } else if (existing instanceof TFile) {
        resultSetting.setDesc(
          "ERROR: Invalid folder for campaign. File exists at that path.",
        );
        valid = false;
      }

      const campaignFileName = normalizePath(
        this.campaignInfo.folder + "/" + this.campaignInfo.campaignName,
      );
      const existingCampaign =
        this.plugin.campaignManager.campaignForPath(campaignFileName);
      if (existingCampaign) {
        resultSetting.setDesc(
          `ERROR: The folder '${this.campaignInfo.folder}' is part of the campaign at '${existingCampaign.file.path}'. Campaigns may not be nested.`,
        );
        valid = false;
      }

      createButton.setDisabled(!valid);
    };

    new Setting(contentEl).setName("Create a campaign").setHeading();

    new Setting(contentEl)
      .setName("Campaign name")
      .setDesc(
        "A brief name for the campaign. You can change this at any time.",
      )
      .addText((text) =>
        text
          .setPlaceholder("My campaign")
          .setValue(this.campaignInfo.campaignName)
          .onChange((val) => {
            this.campaignInfo.campaignName = val;
            folderInput.setValue(this.campaignInfo.campaignName);
            folderInput.onChanged();
            validate();
          }),
      );

    const DEFAULT_FOLDER_DESC =
      "Folder that houses the campaign. All content under this folder is considered part of the campaign.";

    let folderInput!: TextComponent;
    new Setting(contentEl)
      .setName("Folder")
      .setDesc(DEFAULT_FOLDER_DESC)
      .addText((text) => {
        new FolderTextSuggest(this.app, text.inputEl);

        (folderInput = text)
          .setPlaceholder("/")
          .setValue(
            this.campaignInfo.folder == "/" ? "" : this.campaignInfo.folder,
          )
          .onChange(async (val) => {
            this.campaignInfo.folder = normalizePath(val);
            validate();
          });
      });

    const resultSetting = new Setting(contentEl).setDesc("X will be Y.");

    let playsetDropdown!: DropdownComponent;
    new Setting(contentEl)
      .setName("Playset")
      .setTooltip(
        "The playset selects the content from the official rulebooks and from your " +
          "configured Homebrew to make available in this campaign.",
      )
      .addExtraButton((btn) =>
        btn
          .setIcon("settings")
          .onClick(async () => {
            const { playset, customConfig } = await PlaysetEditor.open(
              this.app,
              this.plugin.datastore.indexer,
              this.campaignInfo.playsetOption,
              this.campaignInfo.customPlaysetDefn,
            );
            if (playset == "custom") {
              this.campaignInfo.customPlaysetDefn = customConfig;
            }
            playsetDropdown.setValue(playset);
            playsetDropdown.selectEl.trigger("change");
          })
          .setTooltip("View playsets or configure a custom playset"),
      )
      .addDropdown((dropdown) => {
        (playsetDropdown = dropdown)
          .addOptions(PlaysetEditor.playsetOptions())
          .setValue(this.campaignInfo.playsetOption)
          .onChange((val) => {
            this.campaignInfo.playsetOption = val;
            validate();
          });
      });

    new Setting(contentEl)
      .setName("Scaffold campaign")
      .setDesc(
        "Should some default files and folders, such as entity folders, truths, etc, be auto-generated on campaign creation? You will be prompted about a new character.",
      )
      .addToggle((toggle) => {
        toggle.setValue(this.campaignInfo.scaffold).onChange((val) => {
          this.campaignInfo.scaffold = val;
        });
      });

    let createButton!: ButtonComponent;
    new Setting(contentEl)
      .addButton((btn) =>
        (createButton = btn)
          .setCta()
          .setButtonText("Create")
          .onClick(() => {
            this.resolve(this.campaignInfo);
            this.close();
          }),
      )
      .addButton((btn) =>
        btn.setButtonText("Cancel").onClick(() => this.close()),
      );

    validate();
  }

  onClose(): void {
    this.reject(new Error("user cancelled"));
  }
}
