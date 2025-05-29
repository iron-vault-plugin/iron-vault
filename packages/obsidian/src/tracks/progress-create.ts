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
import { CharacterSelectComponent } from "utils/ui/settings/character-select";
import { FolderTextSuggest } from "utils/ui/settings/folder";
import { GenericTextSuggest } from "utils/ui/settings/generic-text-suggest";
import { RelativeFolderSearchComponent } from "utils/ui/settings/relative-folder-search";
import { ChallengeRanks, ProgressTrack } from "./progress";

export type ProgressTrackCreateResultType = {
  rank: ChallengeRanks;
  progress: number;
  name: string;
  trackType: string;
  fileName: string;
  targetFolder: string;
  character: string | undefined;
};

export class ProgressTrackCreateModal extends Modal {
  public result: ProgressTrackCreateResultType = {
    rank: ChallengeRanks.Dangerous,
    progress: 0,
    name: "",
    trackType: "",
    fileName: "",
    targetFolder: "",
    character: undefined,
  };

  public accepted: boolean = false;

  constructor(
    readonly plugin: IronVaultPlugin,
    defaults: Partial<ProgressTrackCreateResultType> = {},
    protected readonly onAccept: (arg: {
      name: string;
      trackType: string;
      character: string | undefined;
      targetFolder: string;
      fileName: string;
      track: ProgressTrack;
    }) => void,
    protected readonly onCancel: () => void,
  ) {
    super(plugin.app);
    Object.assign(this.result, defaults);
  }

  static async show(plugin: IronVaultPlugin): Promise<{
    name: string;
    trackType: string;
    character: string | undefined;
    targetFolder: string;
    fileName: string;
    track: ProgressTrack;
  }> {
    return new Promise((onAccept, onReject) => {
      try {
        new ProgressTrackCreateModal(
          plugin,
          { targetFolder: plugin.settings.defaultProgressTrackFolder },
          onAccept,
          onReject,
        ).open();
      } catch (error) {
        onReject(error);
      }
    });
  }

  onOpen(): void {
    this.accepted = false;

    const { contentEl } = this;
    new Setting(contentEl).setName("New progress track").setHeading();

    let campaign!: CampaignFile;
    let characterSelect!: CharacterSelectComponent;

    const onChangeCampaign = () => {
      //TODO(@cwegrzyn): this should update to use the campaign-specific folder
      const context = this.plugin.campaignManager.campaignContextFor(campaign);
      folderComponent
        .setBaseFolder(campaign.file.parent!)
        .setValue(this.plugin.settings.defaultProgressTrackFolder)
        .onChanged();
      trackTypeSuggest.items = [...context.trackTypes];
      characterSelect.setCampaignContext(context);
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
        .setDesc("New track will be created in this campaign."),
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

    CharacterSelectComponent.addToSetting(
      new Setting(contentEl)
        .setName("Character")
        .setDesc(
          "Track will be associated with this character. Leave blank for a shared track.",
        ),
      this.plugin,
      (select) => {
        characterSelect = select
          .onChange((path) => {
            this.result.character = path == "" ? undefined : `[[${path}]]`;
            validate();
          })
          .allowEmpty(true)
          .defaultToActiveCharacter(true);
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
        new FolderTextSuggest(this.app, search.inputEl);
        folderComponent = search
          .setPlaceholder("Choose a folder")
          .setValue(this.result.targetFolder)
          .onChange((_relpath, newPath, folder) => {
            this.result.targetFolder = newPath;
            if (folder) {
              folderSetting.setDesc(
                `Creating track in existing folder '${newPath}'`,
              );
            } else {
              folderSetting.setDesc(
                `Creating track in new folder '${newPath}'`,
              );
            }
          });
      },
    );

    // TODO: since the string value equals the display string, i don't actually know if this
    //   is working as intended with the options
    new Setting(contentEl).setName("Rank").addDropdown((dropdown) =>
      dropdown
        .addOptions(ChallengeRanks)
        .onChange((value) => {
          this.result.rank = value as ChallengeRanks;
        })
        .setValue(this.result.rank),
    );

    let trackTypeSuggest!: GenericTextSuggest;
    new Setting(contentEl).setName("Type").addSearch((search) => {
      search.setPlaceholder(
        "What kind of track is this? (e.g., Vow, Connection)",
      );

      trackTypeSuggest = new GenericTextSuggest(this.app, search.inputEl, []);

      search.onChange((value) => {
        this.result.trackType = value;
      });
    });

    let createButton!: ButtonComponent;
    new Setting(contentEl)
      .addButton(
        (btn) =>
          (createButton = btn
            .setButtonText("Create")
            .setCta()
            .onClick(this.accept.bind(this))),
      )
      .addButton((btn) =>
        btn.setButtonText("Cancel").onClick(() => {
          this.accepted = false;
          this.close();
        }),
      );

    onChangeCampaign();
    validate();
  }

  accept(): void {
    this.accepted = true;
    this.close();
    this.onAccept({
      name: this.result.name,
      trackType: this.result.trackType,
      fileName: this.result.fileName,
      targetFolder: this.result.targetFolder,
      character: this.result.character,
      track: ProgressTrack.create_({
        rank: this.result.rank,
        progress: this.result.progress,
        complete: false,
        unbounded: false,
      }),
    });
  }

  onClose(): void {
    this.contentEl.empty();
    if (!this.accepted) {
      this.onCancel();
    }
  }
}
