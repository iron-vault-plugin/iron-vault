import { CampaignFile } from "campaigns/entity";
import IronVaultPlugin from "index";
import {
  ButtonComponent,
  debounce,
  Modal,
  Setting,
  TextComponent,
} from "obsidian";
import { generateObsidianFilename } from "utils/filename";
import { CampaignSelectComponent } from "utils/ui/settings/campaign-suggest";
import { RelativeFolderSearchComponent } from "utils/ui/settings/relative-folder-search";

export type CharacterCreateResultType = {
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

  public result: CharacterCreateResultType = {
    fileName: "",
    name: "",
    targetFolder: "",
  };

  public accepted: boolean = false;

  constructor(
    readonly plugin: IronVaultPlugin,
    defaults: Partial<CharacterCreateResultType> = {},
    protected readonly onAccept: (arg: CharacterCreateResultType) => void,
    protected readonly onCancel: () => void,
  ) {
    super(plugin.app);
    Object.assign(this.result, defaults);
  }

  override onOpen(): void {
    this.accepted = false;

    let fileNameText: TextComponent;

    let campaign!: CampaignFile;

    const onChangeCampaign = () => {
      //TODO(@cwegrzyn): this should update to use the campaign-specific folder
      folderComponent
        .setBaseFolder(campaign.file.parent!)
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

    CampaignSelectComponent.addToSetting(
      new Setting(contentEl)
        .setName("Campaign")
        .setDesc("New character will be created in this campaign."),
      this.plugin,
      (dropdown) => {
        dropdown.onChange((val) => {
          campaign = val;
          onChangeCampaign();
          validate();
        });
        campaign = dropdown.getValue();
      },
    );

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

    let folderComponent!: RelativeFolderSearchComponent;
    const folderSetting = RelativeFolderSearchComponent.addToSetting(
      new Setting(contentEl).setName("Target folder"),
      this.app,
      (search) => {
        folderComponent = search
          .setPlaceholder("Choose a folder")
          .setValue(this.result.targetFolder ?? "")
          .onChange((_newRelPath, newAbsPath, folder) => {
            this.result.targetFolder = newAbsPath;
            if (folder) {
              folderSetting.setDesc(
                `Creating character in existing folder '${newAbsPath}'`,
              );
            } else {
              folderSetting.setDesc(
                `Creating character in new folder '${newAbsPath}'`,
              );
            }
          });
      },
    );

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

  override onClose(): void {
    this.contentEl.empty();
    if (!this.accepted) {
      this.onCancel();
    }
  }
}
