import { CampaignFile } from "campaigns/entity";
import IronVaultPlugin from "index";
import {
  ButtonComponent,
  Modal,
  Setting,
  TextComponent,
  debounce,
} from "obsidian";
import { generateObsidianFilename } from "utils/filename";
import { CampaignSelectComponent } from "utils/ui/settings/campaign-suggest";
import { RelativeFolderSearchComponent } from "utils/ui/settings/relative-folder-search";
import { Clock } from "./clock";

export type ClockCreateResultType = {
  segments: number;
  name: string;
  fileName: string;
  targetFolder: string;
};

export class ClockCreateModal extends Modal {
  public result: ClockCreateResultType = {
    segments: 6,
    name: "",
    fileName: "",
    targetFolder: "",
  };

  public accepted: boolean = false;

  constructor(
    readonly plugin: IronVaultPlugin,
    defaults: Partial<ClockCreateResultType> = {},
    protected readonly onAccept: (arg: {
      name: string;
      targetFolder: string;
      fileName: string;
      clock: Clock;
    }) => void,
    protected readonly onCancel: () => void,
  ) {
    super(plugin.app);
    Object.assign(this.result, defaults);
  }

  onOpen(): void {
    this.accepted = false;

    const { contentEl } = this;
    new Setting(contentEl).setName("New clock").setHeading();

    let campaign!: CampaignFile;

    const onChangeCampaign = () => {
      //TODO(@cwegrzyn): this should update to use the campaign-specific folder
      folderComponent
        .setBaseFolder(campaign.file.parent!)
        .setValue(this.plugin.settings.defaultClockFolder)
        .onChanged();
    };

    const validate = debounce(() => {
      const valid =
        this.result.name.trim().length > 0 &&
        this.result.fileName.trim().length > 0;
      createButton.setDisabled(!valid);
    }, 0);

    CampaignSelectComponent.addToSetting(
      new Setting(contentEl)
        .setName("Campaign")
        .setDesc("New clock will be created in this campaign."),
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

    let fileNameText!: TextComponent;
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
      this.plugin.app,
      (search) => {
        folderComponent = search
          .setPlaceholder("Choose a folder")
          .setValue(this.result.targetFolder)
          .onChange((_relPath, newPath, folder) => {
            this.result.targetFolder = newPath;
            if (folder) {
              folderSetting.setDesc(
                `Creating clock in existing folder '${newPath}'`,
              );
            } else {
              folderSetting.setDesc(
                `Creating clock in new folder '${newPath}'`,
              );
            }
          });
      },
    );

    new Setting(contentEl).setName("Segments").addSlider((slider) =>
      slider
        .setLimits(2, 12, 1)
        .setValue(this.result.segments)
        .setDynamicTooltip()
        .onChange((segments) => {
          this.result.segments = segments;
        }),
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
      name: this.result.name,
      fileName: this.result.fileName,
      targetFolder: this.result.targetFolder,
      clock: Clock.create({
        name: this.result.name,
        progress: 0,
        segments: this.result.segments,
        active: true,
      }).unwrap(),
    });
  }

  onClose(): void {
    this.contentEl.empty();
    if (!this.accepted) {
      this.onCancel();
    }
  }
}
