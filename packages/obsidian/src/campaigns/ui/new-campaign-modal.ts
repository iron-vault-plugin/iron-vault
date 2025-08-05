import IronVaultPlugin from "index";
import {
  ButtonComponent,
  Modal,
  normalizePath,
  Setting,
  TextComponent,
  TFile,
  TFolder,
} from "obsidian";
import { FolderTextSuggest } from "utils/ui/settings/folder";
import { PlaysetSetting } from "./playset-setting";

export type NewCampaignInfo = {
  campaignName: string;
  folder: string;
  scaffold: boolean;
  playsetOption: string;
  customPlaysetDefn: string;
  campaignContentFolder: string;
};

export class NewCampaignModal extends Modal {
  campaignInfo: NewCampaignInfo;

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
    this.campaignInfo = {
      campaignName: "",
      folder: "/",
      scaffold: true,
      playsetOption: "starforged",
      customPlaysetDefn: "",
      campaignContentFolder: this.plugin.settings.defaultCampaignContentFolder,
    };
  }

  override onOpen(): void {
    const { contentEl } = this;

    const validate = () => {
      let valid: boolean = true;

      valid &&= (this.campaignInfo.campaignName ?? "").length > 0;

      valid &&= playsetSetting.isValid();

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

    const playsetSetting = new PlaysetSetting(
      this.plugin,
      this.contentEl,
    ).onChange((setting) => {
      this.campaignInfo.playsetOption = setting.playsetKey();
      this.campaignInfo.customPlaysetDefn = setting.customConfig;
      validate();
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

    new Setting(this.contentEl).setName("Folders").setHeading();

    new Setting(this.contentEl)
      .setName("Campaign content")
      .setDesc(
        "Custom homebrew content placed in this folder will be included in the campaign automatically (e.g., without inclusion in the playset).",
      )
      .addText((text) => {
        // TODO: add invalid folder name check
        text
          .setPlaceholder(
            normalizePath(this.plugin.settings.defaultCampaignContentFolder),
          )
          .setValue(this.campaignInfo.campaignContentFolder)
          .onChange((value) => {
            this.campaignInfo.campaignContentFolder = normalizePath(
              value || this.plugin.settings.defaultCampaignContentFolder,
            );
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

    // Set value after everything is set, so that we can successfully respond to the validation
    // that this triggers.
    playsetSetting.setFromKeyAndConfig(
      this.campaignInfo.playsetOption,
      this.campaignInfo.customPlaysetDefn,
    );
  }

  override onClose(): void {
    this.reject(new Error("user cancelled"));
  }
}
