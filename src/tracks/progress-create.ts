import {
  App,
  Modal,
  SearchComponent,
  Setting,
  TextComponent,
  normalizePath,
} from "obsidian";
import { generateObsidianFilename } from "utils/filename";
import { FolderTextSuggest } from "utils/ui/settings/folder";
import { GenericTextSuggest } from "utils/ui/settings/generic-text-suggest";
import { ChallengeRanks, ProgressTrack } from "./progress";

export type ProgressTrackCreateResultType = {
  rank: ChallengeRanks;
  progress: number;
  name: string;
  tracktype: string;
  fileName: string;
  targetFolder: string;
};

export class ProgressTrackCreateModal extends Modal {
  public result: ProgressTrackCreateResultType = {
    rank: ChallengeRanks.Dangerous,
    progress: 0,
    name: "",
    tracktype: "",
    fileName: "",
    targetFolder: "",
  };

  public accepted: boolean = false;

  constructor(
    app: App,
    defaults: Partial<ProgressTrackCreateResultType> = {},
    protected readonly onAccept: (arg: {
      name: string;
      tracktype: string;
      targetFolder: string;
      fileName: string;
      track: ProgressTrack;
    }) => void,
    protected readonly onCancel: () => void,
  ) {
    super(app);
    Object.assign(this.result, defaults);
  }

  onOpen(): void {
    this.accepted = false;

    const { contentEl } = this;
    new Setting(contentEl).setName("New Progress Track").setHeading();

    let fileNameText: TextComponent;

    new Setting(contentEl).setName("Name").addText((text) =>
      text.onChange((value) => {
        this.result.name = value;
        // TODO: could add smarter logic to only update if user hasn't made a specific value
        fileNameText.setValue(generateObsidianFilename(value)).onChanged();
      }),
    );

    new Setting(contentEl).setName("File name").addText(
      (text) =>
        (fileNameText = text.onChange((value) => {
          this.result.fileName = value;
        })),
    );

    let folderComponent!: SearchComponent;
    const folderSetting = new Setting(contentEl)
      .setName("Target folder")
      .addSearch((search) => {
        new FolderTextSuggest(this.app, search.inputEl);
        folderComponent = search
          .setPlaceholder("Choose a folder")
          .setValue(this.result.targetFolder)
          .onChange((newFolder) => {
            this.result.targetFolder = newFolder;
            const normalized = normalizePath(newFolder);
            if (this.app.vault.getFolderByPath(normalized)) {
              folderSetting.setDesc(
                `Creating track in existing folder '${normalized}'`,
              );
            } else {
              folderSetting.setDesc(
                `Creating track in new folder '${normalized}`,
              );
            }
          });
      });

    folderComponent.onChanged();

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

    new Setting(contentEl).setName("Type").addSearch((search) => {
      search.setPlaceholder(
        "What kind of track is this? (e.g., Vow, Connection)",
      );

      new GenericTextSuggest(this.app, search.inputEl, [
        "Vow",
        "Connection",
        "Combat",
        "Scene Challenge",
        "Expedition",
      ]);

      search.onChange((value) => {
        this.result.tracktype = value;
      });
    });

    new Setting(contentEl)
      .addButton((btn) =>
        btn
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
      tracktype: this.result.tracktype,
      fileName: this.result.fileName,
      targetFolder: this.result.targetFolder,
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
