import { CampaignFile } from "campaigns/entity";
import IronVaultPlugin from "index";
import { ButtonComponent, Modal, Setting, debounce } from "obsidian";
import { CampaignSelectComponent } from "utils/ui/settings/campaign-suggest";
import { RelativeFolderSearchComponent } from "utils/ui/settings/relative-folder-search";

export type FactionInfluenceGridCreateResultType = {
  fileName: string;
  targetFolder: string;
};

export class FactionInfluenceGridCreateModal extends Modal {
  public result: FactionInfluenceGridCreateResultType = {
    fileName: "",
    targetFolder: "",
  };

  public accepted: boolean = false;

  constructor(
    readonly plugin: IronVaultPlugin,
    defaults: Partial<FactionInfluenceGridCreateResultType> = {},
    protected readonly onAccept: (arg: {
      targetFolder: string;
      fileName: string;
    }) => void,
    protected readonly onCancel: () => void,
  ) {
    super(plugin.app);
    Object.assign(this.result, defaults);
  }

  override onOpen(): void {
    this.accepted = false;

    const { contentEl } = this;
    new Setting(contentEl).setName("New faction influence grid").setHeading();

    let campaign!: CampaignFile;

    const onChangeCampaign = () => {
      //TODO(@cwegrzyn): this should update to use the campaign-specific folder
      folderComponent
        .setBaseFolder(campaign.file.parent!)
        // TODO(@zkat): Make this a setting.
        .setValue("Factions")
        .onChanged();
    };

    const validate = debounce(() => {
      const valid = this.result.fileName.trim().length > 0;
      createButton.setDisabled(!valid);
    }, 0);

    CampaignSelectComponent.addToSetting(
      new Setting(contentEl)
        .setName("Campaign")
        .setDesc(
          "New faction influence grid will be created in this campaign.",
        ),
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

    this.result.fileName = "Faction Influence Grid";
    new Setting(contentEl).setName("File name").addText((text) =>
      text.setValue(this.result.fileName).onChange((value) => {
        this.result.fileName = value;
        validate();
      }),
    );

    let folderComponent!: RelativeFolderSearchComponent;
    const folderSetting = RelativeFolderSearchComponent.addToSetting(
      new Setting(contentEl).setName("Target folder"),
      this.plugin.app,
      (search) => {
        folderComponent = search
          .setPlaceholder("Choose a folder")
          .setValue(this.result.targetFolder)
          .onChange((_relPath, newPath, folder) => {
            this.result.targetFolder = newPath;
            if (folder) {
              folderSetting.setDesc(
                `Creating faction influence grid in existing folder '${newPath}'`,
              );
            } else {
              folderSetting.setDesc(
                `Creating faction influence grid in new folder '${newPath}'`,
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
    this.onAccept({
      fileName: this.result.fileName,
      targetFolder: this.result.targetFolder,
    });
  }

  override onClose(): void {
    this.contentEl.empty();
    if (!this.accepted) {
      this.onCancel();
    }
  }
}
