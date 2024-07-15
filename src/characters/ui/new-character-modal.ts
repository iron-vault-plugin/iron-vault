import { CampaignFile } from "campaigns/entity";
import IronVaultPlugin from "index";
import { onlyValid } from "indexer/index-impl";
import {
  ButtonComponent,
  debounce,
  Modal,
  Notice,
  SearchComponent,
  Setting,
  TextComponent,
} from "obsidian";
import { generateObsidianFilename } from "utils/filename";
import { joinPaths } from "utils/obsidian";
import { FolderTextSuggest } from "utils/ui/settings/folder";

export type CharacterCreateResultType = {
  campaign: CampaignFile;
  name: string;
  fileName: string;
  targetFolder: string;
};

export class CharacterCreateModal extends Modal {
  static show(
    plugin: IronVaultPlugin,
    defaults: Partial<CharacterCreateResultType> = {},
  ): Promise<CharacterCreateResultType> {
    return new Promise((resolve, reject) => {
      try {
        new this(plugin, defaults, resolve, reject).open();
      } catch (e) {
        reject(e);
      }
    });
  }

  public result!: CharacterCreateResultType;

  public accepted: boolean = false;

  constructor(
    readonly plugin: IronVaultPlugin,
    protected readonly defaults: Partial<CharacterCreateResultType> = {},
    protected readonly onAccept: (arg: CharacterCreateResultType) => void,
    protected readonly onCancel: () => void,
  ) {
    super(plugin.app);
  }

  onOpen(): void {
    this.accepted = false;

    let fileNameText: TextComponent;

    const availCampaigns = [...onlyValid(this.plugin.campaigns).entries()];
    const campaigns: [string, string][] = availCampaigns.map(
      ([key, campaign]) => [key, campaign.name],
    );
    if (campaigns.length == 0) {
      new Notice(
        "You must create a campaign before you can create a character.",
      );
      this.close();
      return;
    }

    this.result = Object.assign(
      {
        campaign:
          this.plugin.campaignManager.lastActiveCampaign() ??
          availCampaigns[0][1],
        name: "",
        fileName: "",
        targetFolder: "",
      } as CharacterCreateResultType,
      this.defaults,
    );

    const onChangeCampaign = () => {
      //TODO(@cwegrzyn): this should update to use the campaign-specific folder
      folderSuggest.setBaseFolder(this.result.campaign.file.parent!);
      folderComponent
        .setValue(this.plugin.settings.defaultCharactersFolder)
        .onChanged();
    };

    const validate = debounce(() => {
      const valid =
        this.result.name.trim().length > 0 &&
        this.result.fileName.trim().length > 0;
      createButton.setDisabled(!valid);
    }, 0);

    const { contentEl } = this;
    new Setting(contentEl).setName("New character").setHeading();
    new Setting(contentEl)
      .setName("Campaign")
      .setDesc("New character will be created in this campaign.")
      .addDropdown((dropdown) => {
        dropdown
          .addOptions(Object.fromEntries(campaigns))
          .setValue(this.result.campaign.file.path)
          .onChange((val) => {
            this.result.campaign = this.plugin.campaigns
              .get(val)!
              .expect("should be a valid campaign");
            onChangeCampaign();
            validate();
          });
      });

    new Setting(contentEl).setName("Name").addText((text) =>
      text.onChange((value) => {
        this.result.name = value;
        // TODO: could add smarter logic to only update if user hasn't made a specific value
        fileNameText.setValue(generateObsidianFilename(value)).onChanged();
        validate();
      }),
    );

    new Setting(contentEl).setName("File name").addText(
      (text) =>
        (fileNameText = text.onChange((value) => {
          this.result.fileName = value;
          validate();
        })),
    );

    let folderComponent!: SearchComponent;
    let folderSuggest!: FolderTextSuggest;
    const folderSetting = new Setting(contentEl)
      .setName("Target folder")
      .addSearch((search) => {
        folderSuggest = new FolderTextSuggest(this.app, search.inputEl);

        folderComponent = search
          .setPlaceholder("Choose a folder")
          .setValue(this.result.targetFolder ?? "")
          .onChange((newFolder) => {
            const normalized = joinPaths(
              this.result.campaign.file.parent!,
              newFolder,
            );
            this.result.targetFolder = normalized;
            if (this.app.vault.getFolderByPath(normalized)) {
              folderSetting.setDesc(
                `Creating character in existing folder '${normalized}'`,
              );
            } else {
              folderSetting.setDesc(
                `Creating character in new folder '${normalized}`,
              );
            }
          });
      });

    onChangeCampaign();
    validate();

    let createButton!: ButtonComponent;
    new Setting(contentEl)
      .addButton((btn) =>
        (createButton = btn)
          .setButtonText("Create")
          .setCta()
          .onClick(() => {
            this.accept();
          }),
      )
      .addButton((btn) =>
        btn.setButtonText("Cancel").onClick(() => {
          this.accepted = false;
          this.close();
        }),
      );
  }

  accept(): void {
    this.accepted = true;
    this.close();
    this.onAccept(this.result as CharacterCreateResultType);
  }

  onClose(): void {
    this.contentEl.empty();
    if (!this.accepted) {
      this.onCancel();
    }
  }
}
